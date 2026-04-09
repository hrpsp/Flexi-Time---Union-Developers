import { prisma }          from "@/lib/prisma"
import { auth }            from "@/lib/auth"
import { withPermission, json } from "@/lib/with-permission"
import { z }              from "zod"

const schema = z.object({
  dol:    z.string().min(1, "Date of leaving is required."),
  reason: z.string().optional(),
})

// ── POST /api/employees/[id]/deactivate ──────────────────────────────────────
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await withPermission("employees:deactivate")
  if (guard) return guard

  const session = await auth()
  const body    = await req.json()
  const parsed  = schema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 422)

  const { dol, reason } = parsed.data

  const before = await prisma.employee.findUnique({
    where:  { id: params.id },
    select: { id: true, name: true, status: true },
  })
  if (!before)                       return json({ error: "Employee not found."           }, 404)
  if (before.status === "INACTIVE")  return json({ error: "Employee is already inactive." }, 409)

  const dolDate = new Date(dol)

  const [employee] = await prisma.$transaction([
    prisma.employee.update({
      where:  { id: params.id },
      data:   { status: "INACTIVE", dol: dolDate },
      select: {
        id: true, hcmId: true, name: true, status: true,
        dol: true, designation: true,
        department: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.employeeStatusHistory.create({
      data: {
        employeeId:   params.id,
        status:       "INACTIVE",
        effectiveDate: dolDate,
        reason:       reason?.trim() || null,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId:     session!.user.id,
        action:     "EMPLOYEE_DEACTIVATE",
        entityType: "Employee",
        entityId:   params.id,
        before:     { status: "ACTIVE" },
        after:      { status: "INACTIVE", dol, reason: reason ?? null },
      },
    }),
  ])

  return json({ employee })
}
