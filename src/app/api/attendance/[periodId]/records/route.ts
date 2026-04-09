import { NextRequest } from "next/server"
import { withPermission, json } from "@/lib/with-permission"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

// ── GET /api/attendance/[periodId]/records ────────────────────────────────────
// Query: departmentId?, search?
export async function GET(
  req: NextRequest,
  { params }: { params: { periodId: string } }
) {
  const guard = await withPermission("attendance:read")
  if (guard) return guard

  const { searchParams } = req.nextUrl
  const departmentId = searchParams.get("departmentId") ?? undefined
  const search       = searchParams.get("search")       ?? undefined

  // Validate period
  const period = await prisma.attendancePeriod.findUnique({
    where: { id: params.periodId },
  })
  if (!period) return json({ error: "Period not found" }, 404)

  // Build typed where clause
  const where: Prisma.EmployeeWhereInput = {
    attendance: { some: { periodId: params.periodId } },
    ...(departmentId ? { departmentId } : {}),
    ...(search
      ? {
          OR: [
            { name:    { contains: search, mode: "insensitive" } },
            { hcmId: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const employees = await prisma.employee.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id:          true,
      hcmId:       true,
      name:        true,
      designation: true,
      department: {
        select: { id: true, name: true, code: true },
      },
      attendance: {
        where:  { periodId: params.periodId },
        select: {
          id:               true,
          date:             true,
          inTime:           true,
          outTime:          true,
          workedMinutes:    true,
          calculatedStatus: true,
          overriddenStatus: true,
          leaveType:        true,
          note:             true,
        },
      },
    },
  })

  const stats: Record<string, number> = {}

  const mappedEmployees = employees.map((emp) => {
    const records = emp.attendance.map((rec) => {
      const date = rec.date instanceof Date
        ? rec.date.toISOString().slice(0, 10)
        : String(rec.date).slice(0, 10)

      const effectiveStatus = rec.overriddenStatus ?? rec.calculatedStatus
      const isOverridden    = !!rec.overriddenStatus

      stats[effectiveStatus] = (stats[effectiveStatus] ?? 0) + 1

      return {
        id:               rec.id,
        date,
        inTime:           rec.inTime,
        outTime:          rec.outTime,
        workedMinutes:    rec.workedMinutes,
        calculatedStatus: rec.calculatedStatus as string,
        overriddenStatus: rec.overriddenStatus as string | null,
        leaveType:        rec.leaveType as string | null,
        note:             rec.note,
        effectiveStatus:  effectiveStatus as string,
        isOverridden,
      }
    })

    return {
      id:          emp.id,
      hcmId:       emp.hcmId,
      name:        emp.name,
      designation: emp.designation,
      department:  emp.department,
      records,
    }
  })

  return json({ employees: mappedEmployees, stats })
}
