import { withPermission, json } from "@/lib/with-permission"
import { prisma } from "@/lib/prisma"
import { fmtWorked } from "@/lib/attendance-calc"
import { z } from "zod"
import type { Prisma } from "@prisma/client"

const schema = z.object({
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departmentIds: z.array(z.string()).optional(),
  statuses:      z.array(z.string()).optional(),
})

// ── POST /api/reports/daily ───────────────────────────────────────────────────
export async function POST(req: Request) {
  const guard = await withPermission("reports:read")
  if (guard) return guard

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const { date, departmentIds, statuses } = parsed.data
  const dateObj = new Date(date + "T00:00:00.000Z")

  // Build where clause
  const where: Prisma.AttendanceRecordWhereInput = {
    date: dateObj,
    ...(departmentIds?.length
      ? { employee: { departmentId: { in: departmentIds } } }
      : {}),
    ...(statuses?.length
      ? {
          OR: [
            { overriddenStatus: { in: statuses as Prisma.EnumAttendanceStatusFilter["in"] } },
            {
              AND: [
                { overriddenStatus: null },
                { calculatedStatus: { in: statuses as Prisma.EnumAttendanceStatusFilter["in"] } },
              ],
            },
          ],
        }
      : {}),
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    orderBy: [
      { employee: { department: { name: "asc" } } },
      { employee: { name: "asc" } },
    ],
    select: {
      id:               true,
      inTime:           true,
      outTime:          true,
      workedMinutes:    true,
      calculatedStatus: true,
      overriddenStatus: true,
      note:             true,
      employee: {
        select: {
          hcmId:      true,
          name:       true,
          department: { select: { name: true } },
        },
      },
    },
  })

  const rows = records.map((r) => ({
    id:           r.id,
    hcmId:        r.employee.hcmId,
    name:         r.employee.name,
    department:   r.employee.department?.name ?? "—",
    inTime:       r.inTime  ?? "—",
    outTime:      r.outTime ?? "—",
    workedMinutes: r.workedMinutes,
    workedHours:  r.workedMinutes ? fmtWorked(r.workedMinutes) : "—",
    status:       r.overriddenStatus ?? r.calculatedStatus,
    note:         r.note ?? "",
  }))

  return json({ rows, date, total: rows.length })
}
