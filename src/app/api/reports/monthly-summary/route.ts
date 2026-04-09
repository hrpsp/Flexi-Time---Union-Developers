import { withPermission, json } from "@/lib/with-permission"
import { prisma } from "@/lib/prisma"
import { eachDayOfInterval } from "date-fns"
import { z } from "zod"
import type { Prisma } from "@prisma/client"

const schema = z.object({
  periodId:       z.string(),
  departmentIds:  z.array(z.string()).optional(),
  employeeStatus: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional().default("ALL"),
})

// ── POST /api/reports/monthly-summary ────────────────────────────────────────
export async function POST(req: Request) {
  const guard = await withPermission("reports:read")
  if (guard) return guard

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const { periodId, departmentIds, employeeStatus } = parsed.data

  // Validate period
  const period = await prisma.attendancePeriod.findUnique({ where: { id: periodId } })
  if (!period) return json({ error: "Period not found." }, 404)

  // Count working days (non-Sunday days in range)
  const days = eachDayOfInterval({
    start: new Date(period.startDate),
    end:   new Date(period.endDate),
  })
  const workingDays = days.filter((d) => d.getDay() !== 0).length

  // Build employee filter
  const empWhere: Prisma.EmployeeWhereInput = {
    attendance: { some: { periodId } },
    ...(departmentIds?.length ? { departmentId: { in: departmentIds } } : {}),
    ...(employeeStatus !== "ALL" ? { status: employeeStatus } : {}),
  }

  const employees = await prisma.employee.findMany({
    where:   empWhere,
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
    select: {
      id:          true,
      hcmId:       true,
      name:        true,
      designation: true,
      department:  { select: { name: true } },
      attendance: {
        where:  { periodId },
        select: { calculatedStatus: true, overriddenStatus: true },
      },
    },
  })

  const rows = employees.map((emp) => {
    const counts: Record<string, number> = {
      PRESENT: 0, SHORT_TIME: 0, HALF_DAY: 0, ABSENT: 0,
      LEAVE: 0, MISSING_IN: 0, MISSING_OUT: 0, UNMARKED: 0, OFF: 0,
    }
    for (const rec of emp.attendance) {
      const s = (rec.overriddenStatus ?? rec.calculatedStatus) as string
      counts[s] = (counts[s] ?? 0) + 1
    }
    const attendanceDays = counts.PRESENT + counts.SHORT_TIME + counts.HALF_DAY
    const attendancePct  = workingDays > 0
      ? Math.round((attendanceDays / workingDays) * 100 * 10) / 10
      : 0

    return {
      hcmId:         emp.hcmId,
      name:          emp.name,
      department:    emp.department?.name ?? "—",
      designation:   emp.designation ?? "—",
      workingDays,
      present:       counts.PRESENT,
      shortTime:     counts.SHORT_TIME,
      halfDay:       counts.HALF_DAY,
      absent:        counts.ABSENT,
      leave:         counts.LEAVE,
      missingIn:     counts.MISSING_IN,
      missingOut:    counts.MISSING_OUT,
      unmarked:      counts.UNMARKED,
      attendancePct,
    }
  })

  return json({
    rows,
    period: {
      label:     period.label,
      startDate: period.startDate.toISOString().slice(0, 10),
      endDate:   period.endDate.toISOString().slice(0, 10),
    },
    workingDays,
    total: rows.length,
  })
}
