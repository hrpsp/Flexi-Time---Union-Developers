import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { withPermission, json } from "@/lib/with-permission"
import { createEmployeeSchema, employeeQuerySchema } from "@/lib/validations/employees"

// ── GET /api/employees ────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const guard = await withPermission("employees:read")
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const parsed = employeeQuerySchema.safeParse({
    search:       searchParams.get("search")       ?? undefined,
    departmentId: searchParams.get("departmentId") ?? undefined,
    division:     searchParams.get("division")     ?? undefined,
    grade:        searchParams.get("grade")        ?? undefined,
    project:      searchParams.get("project")      ?? undefined,
    gender:       searchParams.get("gender")       ?? undefined,
    status:       searchParams.get("status")       ?? "ACTIVE",
    page:         searchParams.get("page")         ?? 1,
    limit:        searchParams.get("limit")        ?? 25,
  })
  if (!parsed.success) return json({ error: "Invalid query params" }, 400)

  const { search, departmentId, division, grade, project, gender, status, page, limit } = parsed.data
  const skip = (page - 1) * limit

  const baseWhere = {
    ...(departmentId ? { departmentId } : {}),
    ...(division     ? { division: division as "SUPPORT_SERVICES"|"INFRASTRUCTURE"|"CONSTRUCTION"|"COMMERCIAL" } : {}),
    ...(grade        ? { grade: { contains: grade, mode: "insensitive" as const } } : {}),
    ...(project      ? { project: { contains: project, mode: "insensitive" as const } } : {}),
    ...(gender       ? { gender: gender as "MALE"|"FEMALE" } : {}),
    ...(search
      ? {
          OR: [
            { name:  { contains: search, mode: "insensitive" as const } },
            { hcmId: { contains: search, mode: "insensitive" as const } },
            { cnic:  { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const where = {
    ...baseWhere,
    ...(status !== "ALL" ? { status: status as "ACTIVE" | "INACTIVE" } : {}),
  }

  const [employees, total, activeCnt, inactiveCnt] = await Promise.all([
    prisma.employee.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { name: "asc" },
      select: {
        id:          true,
        hcmId:       true,
        name:        true,
        designation: true,
        grade:       true,
        division:    true,
        project:     true,
        status:      true,
        dol:         true,
        contactNumber: true,
        email:       true,
        createdAt:   true,
        department: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.employee.count({ where }),
    prisma.employee.count({ where: { ...baseWhere, status: "ACTIVE"   } }),
    prisma.employee.count({ where: { ...baseWhere, status: "INACTIVE" } }),
  ])

  return json({
    employees,
    meta:   { total, page, limit, totalPages: Math.ceil(total / limit) },
    counts: { active: activeCnt, inactive: inactiveCnt },
  })
}

// ── POST /api/employees ───────────────────────────────────────────────────────
export async function POST(req: Request) {
  const guard = await withPermission("employees:create")
  if (guard) return guard

  const session = await auth()
  const body    = await req.json()
  const parsed  = createEmployeeSchema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const data = parsed.data

  // Uniqueness checks
  const conflicts = await prisma.employee.findFirst({
    where: {
      OR: [
        { hcmId: data.hcmId },
        ...(data.cnic ? [{ cnic: data.cnic }] : []),
      ],
    },
    select: { hcmId: true, cnic: true },
  })

  if (conflicts) {
    const field = conflicts.hcmId === data.hcmId ? "hcmId" : "cnic"
    return json({ error: `An employee with this ${field} already exists.` }, 409)
  }

  const employee = await prisma.employee.create({
    data: {
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
      status:           "ACTIVE",
    },
    include: { department: { select: { id: true, name: true, code: true } } },
  })

  await prisma.employeeStatusHistory.create({
    data: {
      employeeId:    employee.id,
      status:        "ACTIVE",
      effectiveDate: employee.doj ?? employee.createdAt,
      reason:        "Initial record",
    },
  })

  await prisma.auditLog.create({
    data: {
      userId:     session!.user.id,
      action:     "EMPLOYEE_CREATE",
      entityType: "Employee",
      entityId:   employee.id,
      after:      { hcmId: data.hcmId, name: data.name },
    },
  })

  return json({ employee }, 201)
}
