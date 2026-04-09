import { withPermission, json } from "@/lib/with-permission"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import type { Prisma } from "@prisma/client"

const schema = z.object({
  departmentIds: z.array(z.string()).optional(),
  status:        z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional().default("ALL"),
  dateFrom:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

function calcTotalDays(
  status:        string,
  doj:           Date | null,
  dol:           Date | null,
  rejoiningDate: Date | null,
): number | null {
  const effectiveStart = rejoiningDate ?? doj
  if (!effectiveStart) return null

  if (status === "ACTIVE") {
    return Math.floor((Date.now() - effectiveStart.getTime()) / 86_400_000)
  } else {
    if (!dol) return null
    return Math.max(0, Math.floor((dol.getTime() - effectiveStart.getTime()) / 86_400_000))
  }
}

function fmtDate(d: Date | null): string {
  if (!d) return "—"
  return d.toISOString().slice(0, 10)
}

// ── POST /api/reports/employee-status ────────────────────────────────────────
export async function POST(req: Request) {
  const guard = await withPermission("reports:read")
  if (guard) return guard

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const { departmentIds, status, dateFrom, dateTo } = parsed.data

  const where: Prisma.EmployeeWhereInput = {
    ...(departmentIds?.length ? { departmentId: { in: departmentIds } } : {}),
    ...(status !== "ALL" ? { status } : {}),
    // Date range filter: DOJ within range OR DOL within range
    ...((dateFrom || dateTo)
      ? {
          OR: [
            {
              doj: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo   ? { lte: new Date(dateTo + "T23:59:59Z") } : {}),
              },
            },
            {
              dol: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo   ? { lte: new Date(dateTo + "T23:59:59Z") } : {}),
              },
            },
          ],
        }
      : {}),
  }

  const employees = await prisma.employee.findMany({
    where,
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
    select: {
      hcmId:         true,
      name:          true,
      designation:   true,
      status:        true,
      doj:           true,
      dol:           true,
      rejoiningDate: true,
      department:    { select: { name: true } },
      statusHistory: {
        orderBy: { effectiveDate: "desc" },
        take:    1,
        select:  { reason: true, status: true },
      },
    },
  })

  const rows = employees.map((emp) => {
    const totalDays = calcTotalDays(emp.status, emp.doj, emp.dol, emp.rejoiningDate)
    const latestHistory = emp.statusHistory[0]

    return {
      hcmId:         emp.hcmId,
      name:          emp.name,
      department:    emp.department?.name ?? "—",
      designation:   emp.designation ?? "—",
      status:        emp.status,
      doj:           fmtDate(emp.doj),
      dol:           fmtDate(emp.dol),
      rejoiningDate: fmtDate(emp.rejoiningDate),
      totalDays:     totalDays ?? "—",
      reason:        latestHistory?.reason ?? "—",
    }
  })

  return json({ rows, total: rows.length })
}
