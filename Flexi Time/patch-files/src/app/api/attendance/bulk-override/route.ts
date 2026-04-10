import { NextRequest } from "next/server"
import { z } from "zod"
import { withPermission, json } from "@/lib/with-permission"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AttendanceStatus, LeaveType } from "@prisma/client"

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  /** Employee IDs to target */
  employeeIds: z.array(z.string()).min(1, "At least one employee is required"),
  /** Period the records belong to (used when creating records for empty cells) */
  periodId: z.string(),
  /** Status to apply */
  status: z.enum([
    "PRESENT", "SHORT_TIME", "HALF_DAY", "ABSENT",
    "MISSING_IN", "MISSING_OUT", "LEAVE", "UNMARKED", "OFF",
  ] as const),
  leaveType: z
    .enum(["ANNUAL", "SICK", "CASUAL", "EMERGENCY", "UNPAID", "WORK_FROM_HOME"] as const)
    .nullable()
    .optional(),
  note: z.string().max(500).nullable().optional(),
  /**
   * If true (default), only touch records where:
   *   overriddenStatus IS NULL AND calculatedStatus = 'UNMARKED'
   * AND create new records for cells with no row at all.
   * If false, override all records (and still create for empty cells).
   */
  emptyOnly: z.boolean().optional().default(true),
  /**
   * Specific dates (YYYY-MM-DD) to apply the override to.
   * If omitted, all non-Sunday dates within the period are targeted.
   */
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
})

// ── POST /api/attendance/bulk-override ───────────────────────────────────────

export async function POST(req: NextRequest) {
  const guard = await withPermission("attendance:override")
  if (guard) return guard

  const session   = await auth()
  const userId    = session?.user?.id ?? null

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return json({ error: "Validation failed", issues: parsed.error.issues }, 400)
  }

  const { employeeIds, periodId, status, leaveType, note, emptyOnly, dates } = parsed.data

  // Validate period exists
  const period = await prisma.attendancePeriod.findUnique({ where: { id: periodId } })
  if (!period) return json({ error: "Period not found" }, 404)

  // ── Determine target dates ─────────────────────────────────────────────────
  let targetDates: Date[]

  if (dates && dates.length > 0) {
    targetDates = dates.map((d) => new Date(d + "T00:00:00.000Z"))
  } else {
    // All non-Sunday days in the period
    const start = new Date(period.startDate)
    const end   = new Date(period.endDate)
    targetDates = []
    const cur   = new Date(start)
    while (cur <= end) {
      if (cur.getDay() !== 0) targetDates.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
  }

  if (targetDates.length === 0) {
    return json({ updated: 0 })
  }

  const now = new Date()
  const overrideData = {
    overriddenStatus: status as AttendanceStatus,
    leaveType:        status === "LEAVE" ? ((leaveType ?? null) as LeaveType | null) : null,
    note:             note ?? null,
    overriddenById:   userId,
    overriddenAt:     now,
  }

  // ── Step 1: Update existing records ───────────────────────────────────────
  const existingWhere = emptyOnly
    ? {
        employeeId:      { in: employeeIds },
        date:            { in: targetDates },
        overriddenStatus: null,
        calculatedStatus: "UNMARKED" as AttendanceStatus,
      }
    : {
        employeeId: { in: employeeIds },
        date:       { in: targetDates },
      }

  const updateResult = await prisma.attendanceRecord.updateMany({
    where: existingWhere,
    data:  overrideData,
  })

  // ── Step 2: Fetch all existing record keys (to identify gaps) ─────────────
  const existingRecords = await prisma.attendanceRecord.findMany({
    where: {
      employeeId: { in: employeeIds },
      date:       { in: targetDates },
    },
    select: { employeeId: true, date: true },
  })

  const existingSet = new Set(
    existingRecords.map((r) => `${r.employeeId}_${r.date.toISOString().slice(0, 10)}`)
  )

  // ── Step 3: Create records for completely empty cells ─────────────────────
  const toCreate: Array<{
    employeeId:       string
    periodId:         string
    date:             Date
    calculatedStatus: AttendanceStatus
    overriddenStatus: AttendanceStatus
    leaveType:        LeaveType | null
    note:             string | null
    overriddenById:   string | null
    overriddenAt:     Date
  }> = []

  for (const empId of employeeIds) {
    for (const date of targetDates) {
      const key = `${empId}_${date.toISOString().slice(0, 10)}`
      if (!existingSet.has(key)) {
        toCreate.push({
          employeeId:       empId,
          periodId,
          date,
          calculatedStatus: "UNMARKED" as AttendanceStatus,
          overriddenStatus: status as AttendanceStatus,
          leaveType:        status === "LEAVE" ? ((leaveType ?? null) as LeaveType | null) : null,
          note:             note ?? null,
          overriddenById:   userId,
          overriddenAt:     now,
        })
      }
    }
  }

  let createCount = 0
  if (toCreate.length > 0) {
    const createResult = await prisma.attendanceRecord.createMany({
      data:           toCreate,
      skipDuplicates: true,
    })
    createCount = createResult.count
  }

  return json({ updated: updateResult.count + createCount })
}
