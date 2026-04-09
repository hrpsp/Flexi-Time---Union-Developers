import { prisma } from "@/lib/prisma"
import { withPermission, json } from "@/lib/with-permission"
import { calcStatus } from "@/lib/attendance-calc"
import { z } from "zod"

const recordSchema = z.object({
  employeeId: z.string(),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  inTime:     z.string().nullable(),
  outTime:    z.string().nullable(),
})

const syncSchema = z.object({
  periodId: z.string(),
  records:  z.array(recordSchema).min(1).max(10000),
})

// ── POST /api/attendance/sync ─────────────────────────────────────────────────
// Body: { periodId: string, records: { employeeId, date, inTime, outTime }[] }
export async function POST(req: Request) {
  const guard = await withPermission("attendance:upload")
  if (guard) return guard

  const body   = await req.json()
  const parsed = syncSchema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const { periodId, records } = parsed.data

  // Validate period exists
  const period = await prisma.attendancePeriod.findUnique({ where: { id: periodId } })
  if (!period) return json({ error: "Attendance period not found." }, 404)

  // Load default shift config (or fall back to built-in defaults)
  const shiftConfig = await prisma.shiftConfig.findFirst({ where: { isDefault: true } })
  const rules = {
    presentMinutes: shiftConfig?.presentMinutes ?? 465,
    shortTimeMin:   shiftConfig?.shortTimeMin   ?? 391,
    halfDayMin:     shiftConfig?.halfDayMin     ?? 240,
  }

  // Get existing records to track created vs updated
  const dateKeys = new Set(records.map((r) => `${r.employeeId}::${r.date}`))
  const allDates = [...new Set(records.map((r) => new Date(r.date)))]

  const existing = await prisma.attendanceRecord.findMany({
    where: {
      employeeId: { in: [...new Set(records.map((r) => r.employeeId))] },
      date:       { in: allDates },
    },
    select: { employeeId: true, date: true },
  })
  const existingKeys = new Set(
    existing.map((e) => `${e.employeeId}::${e.date.toISOString().slice(0, 10)}`)
  )

  let created = 0
  let updated = 0

  // Upsert in batches
  const BATCH = 200
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async (rec) => {
        const { workedMinutes, status } = calcStatus(rec.inTime, rec.outTime, rules)
        const dateObj = new Date(rec.date)
        const key     = `${rec.employeeId}::${rec.date}`

        if (existingKeys.has(key)) {
          await prisma.attendanceRecord.update({
            where: { employeeId_date: { employeeId: rec.employeeId, date: dateObj } },
            data: {
              periodId,
              inTime:           rec.inTime,
              outTime:          rec.outTime,
              workedMinutes:    workedMinutes || null,
              calculatedStatus: status,
            },
          })
          updated++
        } else {
          await prisma.attendanceRecord.create({
            data: {
              employeeId:       rec.employeeId,
              periodId,
              date:             dateObj,
              inTime:           rec.inTime,
              outTime:          rec.outTime,
              workedMinutes:    workedMinutes || null,
              calculatedStatus: status,
            },
          })
          created++
        }
      })
    )
  }

  return json({ success: true, created, updated, total: records.length })
}
