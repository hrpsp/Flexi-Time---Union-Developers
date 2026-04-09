import { prisma }          from "@/lib/prisma"
import { auth }            from "@/lib/auth"
import { withPermission, json } from "@/lib/with-permission"
import { z }              from "zod"

const importRowSchema = z.object({
  hcmId:           z.string().min(1),
  name:            z.string().min(1),
  departmentId:    z.string().min(1),
  _isNew:          z.boolean(),
  // Identification
  cnic:            z.string().optional(),
  cnicIssueDate:   z.string().optional(),
  cnicExpiryDate:  z.string().optional(),
  // Personal
  fatherName:      z.string().optional(),
  gender:          z.enum(["MALE","FEMALE"]).optional(),
  dateOfBirth:     z.string().optional(),
  maritalStatus:   z.enum(["MARRIED","UN_MARRIED"]).optional(),
  bloodGroup:      z.enum(["A_POS","A_NEG","B_POS","B_NEG","O_POS","O_NEG","AB_POS","AB_NEG"]).optional(),
  religion:        z.enum(["ISLAM","CHRISTIAN","OTHER"]).optional(),
  education:       z.string().optional(),
  contactNumber:   z.string().optional(),
  email:           z.string().optional(),
  address:         z.string().optional(),
  // Emergency / NOK
  nokName:         z.string().optional(),
  nokRelation:     z.string().optional(),
  emergencyContact:z.string().optional(),
  // Employment
  designation:     z.string().optional(),
  grade:           z.string().optional(),
  pgcGrade:        z.string().optional(),
  division:        z.enum(["SUPPORT_SERVICES","INFRASTRUCTURE","CONSTRUCTION","COMMERCIAL"]).optional(),
  project:         z.string().optional(),
  subDepartment:   z.string().optional(),
  doj:             z.string().optional(),
  confirmationDate:z.string().optional(),
})

type ImportRow = z.infer<typeof importRowSchema>

// ── POST /api/employees/import ────────────────────────────────────────────────
export async function POST(req: Request) {
  const guard = await withPermission("employees:import")
  if (guard) return guard

  const session = await auth()
  const body    = await req.json()

  const rowsRaw: unknown[] = Array.isArray(body.rows) ? body.rows : []

  let created = 0
  let updated = 0
  const errors: { row: number; message: string }[] = []

  for (let i = 0; i < rowsRaw.length; i++) {
    const parsed = importRowSchema.safeParse(rowsRaw[i])
    if (!parsed.success) {
      errors.push({ row: i + 2, message: "Invalid row data." })
      continue
    }

    const r = parsed.data

    const data = {
      name:            r.name,
      departmentId:    r.departmentId,
      // Identification
      cnic:            r.cnic            || null,
      cnicIssueDate:   r.cnicIssueDate   ? new Date(r.cnicIssueDate)   : null,
      cnicExpiryDate:  r.cnicExpiryDate  ? new Date(r.cnicExpiryDate)  : null,
      // Personal
      fatherName:      r.fatherName      || null,
      gender:          r.gender          || null,
      dateOfBirth:     r.dateOfBirth     ? new Date(r.dateOfBirth)     : null,
      maritalStatus:   r.maritalStatus   || null,
      bloodGroup:      r.bloodGroup      || null,
      religion:        r.religion        || null,
      education:       r.education       || null,
      contactNumber:   r.contactNumber   || null,
      email:           r.email           || null,
      address:         r.address         || null,
      // Emergency / NOK
      nokName:         r.nokName         || null,
      nokRelation:     r.nokRelation     || null,
      emergencyContact:r.emergencyContact|| null,
      // Employment
      designation:     r.designation     || null,
      grade:           r.grade           || null,
      pgcGrade:        r.pgcGrade        || null,
      division:        r.division        || null,
      project:         r.project         || null,
      subDepartment:   r.subDepartment   || null,
      doj:             r.doj             ? new Date(r.doj)             : null,
      confirmationDate:r.confirmationDate? new Date(r.confirmationDate): null,
    }

    try {
      if (r._isNew) {
        const emp = await prisma.employee.create({
          data:   { hcmId: r.hcmId, ...data },
          select: { id: true },
        })
        await prisma.employeeStatusHistory.create({
          data: {
            employeeId:   emp.id,
            status:       "ACTIVE",
            effectiveDate: new Date(),
          },
        })
        created++
      } else {
        await prisma.employee.update({
          where: { hcmId: r.hcmId },
          data,
        })
        updated++
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Database error."
      errors.push({ row: i + 2, message: msg })
    }
  }

  await prisma.auditLog.create({
    data: {
      userId:     session!.user.id,
      action:     "EMPLOYEE_BULK_IMPORT",
      entityType: "Employee",
      entityId:   "bulk",
      after:      { created, updated, errors: errors.length },
    },
  })

  return json({ created, updated, errors })
}
