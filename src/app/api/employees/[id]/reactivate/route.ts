import { prisma }          from "@/lib/prisma"
import { auth }            from "@/lib/auth"
import { withPermission, json } from "@/lib/with-permission"
import { z }              from "zod"

const schema = z.object({
  rejoiningDate: z.string().min(1, "Date of rejoining is required."),
  designation:   z.string().optional(),
  departmentId:  z.string().optional(),
  note:          z.string().optional(),
})

// ── POST /api/employees/[id]/reactivate ─────────────────────────────────────
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await withPermission("employees:activate")
  if (guard) return guard

  const session = await auth()
  const body    = await req.json()
  const parsed  = schema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 422)

  const { rejoiningDate, designation, departmentId, note } = parsed.data

  const before = await prisma.employee.findUnique({
    where:  { id: params.id },
    select: { id: true, name: true, status: true },
  })
  if (!before)                      return json({ error: "Employee not found."          }, 404)
  if (before.status === "ACTIVE")   return json({ error: "Employee is already active."  }, 409)

  // Validate departmentId if provided
  if (departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: departmentId }, select: { id: true },
    })
    if (!dept) return json({ error: "Department not found." }, 404)
  }

  const rejoiningDateObj = new Date(rejoiningDate)

  const updateData: Record<string, unknown> = {
    status:       "ACTIVE",
    rejoiningDate: rejoiningDateObj,
    dol:          null,
    ...(designation  ? { designation  }  : {}),
    ...(departmentId ? { departmentId }  : {}),
  }

  const [employee] = await prisma.$transaction([
    prisma.employee.update({
      where:  { id: params.id },
      data:   updateData,
      select: {
        id: true, hcmId: true, name: true, status: true,
        doj: true, dol: true, rejoiningDate: true, designation: true,
        department: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.employeeStatusHistory.create({
      data: {
        employeeId:   params.id,
        status:       "ACTIVE",
        effectiveDate: rejoiningDateObj,
        reason:       note?.trim() || null,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId:     session!.user.id,
        action:     "EMPLOYEE_ACTIVATE",
        entityType: "Employee",
        entityId:   params.id,
        before:     { status: "INACTIVE" },
        after:      { status: "ACTIVE", rejoiningDate, note: note ?? null },
      },
    }),
  ])

  return json({ employee })
}
