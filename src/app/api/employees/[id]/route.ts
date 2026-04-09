import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { withPermission, json } from "@/lib/with-permission"
import { editEmployeeSchema } from "@/lib/validations/employees"

const EMPLOYEE_SELECT = {
  id:               true,
  hcmId:            true,
  cnic:             true,
  name:             true,
  fatherName:       true,
  gender:           true,
  dateOfBirth:      true,
  maritalStatus:    true,
  bloodGroup:       true,
  religion:         true,
  education:        true,
  contactNumber:    true,
  email:            true,
  address:          true,
  nokName:          true,
  nokRelation:      true,
  emergencyContact: true,
  designation:      true,
  grade:            true,
  pgcGrade:         true,
  division:         true,
  project:          true,
  subDepartment:    true,
  doj:              true,
  confirmationDate: true,
  cnicIssueDate:    true,
  cnicExpiryDate:   true,
  status:           true,
  dol:              true,
  rejoiningDate:    true,
  createdAt:        true,
  updatedAt:        true,
  department:  { select: { id: true, name: true, code: true } },
  statusHistory: {
    orderBy: { effectiveDate: "desc" as const },
    select:  { id: true, status: true, effectiveDate: true, reason: true, createdAt: true },
  },
}

// ── GET /api/employees/[id] ───────────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await withPermission("employees:read")
  if (guard) return guard

  const employee = await prisma.employee.findUnique({
    where:  { id: params.id },
    select: EMPLOYEE_SELECT,
  })
  if (!employee) return json({ error: "Employee not found." }, 404)

  return json({ employee })
}

// ── PATCH /api/employees/[id] ─────────────────────────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await withPermission("employees:edit")
  if (guard) return guard

  const session = await auth()
  const body    = await req.json()

  // ── Status toggle ──────────────────────────────────────────────────────────
  if ("status" in body && Object.keys(body).length <= 2) {
    const newStatus = body.status as "ACTIVE" | "INACTIVE"
    const reason    = body.reason as string | undefined

    const before = await prisma.employee.findUnique({
      where: { id: params.id }, select: { status: true, name: true },
    })
    if (!before) return json({ error: "Employee not found." }, 404)

    const [employee] = await prisma.$transaction([
      prisma.employee.update({
        where:  { id: params.id },
        data:   { status: newStatus, ...(newStatus === "INACTIVE" ? { dol: new Date() } : { dol: null }) },
        select: EMPLOYEE_SELECT,
      }),
      prisma.employeeStatusHistory.create({
        data: {
          employeeId:   params.id,
          status:       newStatus,
          effectiveDate: new Date(),
          reason:       reason ?? null,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId:     session!.user.id,
          action:     newStatus === "ACTIVE" ? "EMPLOYEE_ACTIVATE" : "EMPLOYEE_DEACTIVATE",
          entityType: "Employee",
          entityId:   params.id,
          before:     { status: before.status },
          after:      { status: newStatus },
        },
      }),
    ])

    return json({ employee })
  }

  // ── Full edit ──────────────────────────────────────────────────────────────
  const parsed = editEmployeeSchema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const data = parsed.data

  const before = await prisma.employee.findUnique({
    where:  { id: params.id },
    select: { name: true, designation: true, departmentId: true },
  })
  if (!before) return json({ error: "Employee not found." }, 404)

  const employee = await prisma.employee.update({
    where: { id: params.id },
    data:  {
      hcmId:            data.hcmId,
      cnic:             data.cnic             ?? null,
      name:             data.name,
      fatherName:       data.fatherName       ?? null,
      gender:           data.gender           ?? null,
      dateOfBirth:      data.dateOfBirth      ? new Date(data.dateOfBirth) : null,
      maritalStatus:    data.maritalStatus    ?? null,
      bloodGroup:       data.bloodGroup       ?? null,
      religion:         data.religion         ?? null,
      education:        data.education        ?? null,
      contactNumber:    data.contactNumber    ?? null,
      email:            data.email            ?? null,
      address:          data.address          ?? null,
      nokName:          data.nokName          ?? null,
      nokRelation:      data.nokRelation      ?? null,
      emergencyContact: data.emergencyContact ?? null,
      designation:      data.designation      ?? null,
      grade:            data.grade            ?? null,
      pgcGrade:         data.pgcGrade         ?? null,
      departmentId:     data.departmentId,
      subDepartment:    data.subDepartment    ?? null,
      division:         data.division         ?? null,
      project:          data.project          ?? null,
      doj:              data.doj              ? new Date(data.doj)              : null,
      confirmationDate: data.confirmationDate ? new Date(data.confirmationDate) : null,
      cnicIssueDate:    data.cnicIssueDate    ? new Date(data.cnicIssueDate)    : null,
      cnicExpiryDate:   data.cnicExpiryDate   ? new Date(data.cnicExpiryDate)   : null,
    },
    select: EMPLOYEE_SELECT,
  })

  await prisma.auditLog.create({
    data: {
      userId:     session!.user.id,
      action:     "EMPLOYEE_EDIT",
      entityType: "Employee",
      entityId:   params.id,
      before:     { name: before.name, designation: before.designation },
      after:      { name: data.name,   designation: data.designation },
    },
  })

  return json({ employee })
}
