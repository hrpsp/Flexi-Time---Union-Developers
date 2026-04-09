import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { EmployeeForm } from "@/components/employees/employee-form"

export const metadata = { title: "Edit Employee — Flexi Time" }

function toDateStr(val: Date | null | undefined): string {
  if (!val) return ""
  try { return format(new Date(val), "yyyy-MM-dd") } catch { return "" }
}

export default async function EditEmployeePage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasPermission(session.user.role, "employees:edit")) redirect(`/employees/${params.id}`)

  const employee = await prisma.employee.findUnique({
    where:  { id: params.id },
    select: {
      id:               true,
      hcmId:            true,
      name:             true,
      fatherName:       true,
      designation:      true,
      departmentId:     true,
      cnic:             true,
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
      grade:            true,
      pgcGrade:         true,
      division:         true,
      project:          true,
      subDepartment:    true,
      doj:              true,
      confirmationDate: true,
      cnicIssueDate:    true,
      cnicExpiryDate:   true,
    },
  })

  if (!employee) notFound()

  const defaultValues = {
    hcmId:            employee.hcmId as string,
    name:             employee.name,
    fatherName:       employee.fatherName       ?? "",
    designation:      employee.designation      ?? "",
    departmentId:     employee.departmentId,
    cnic:             employee.cnic             ?? "",
    gender:           (employee.gender          ?? undefined) as "MALE" | "FEMALE" | undefined,
    dateOfBirth:      toDateStr(employee.dateOfBirth),
    maritalStatus:    (employee.maritalStatus   ?? undefined) as "MARRIED" | "UN_MARRIED" | undefined,
    bloodGroup:       (employee.bloodGroup      ?? undefined) as "A_POS"|"A_NEG"|"B_POS"|"B_NEG"|"O_POS"|"O_NEG"|"AB_POS"|"AB_NEG" | undefined,
    religion:         (employee.religion        ?? undefined) as "ISLAM" | "CHRISTIAN" | "OTHER" | undefined,
    education:        employee.education        ?? "",
    contactNumber:    employee.contactNumber    ?? "",
    email:            employee.email            ?? "",
    address:          employee.address          ?? "",
    nokName:          employee.nokName          ?? "",
    nokRelation:      employee.nokRelation      ?? "",
    emergencyContact: employee.emergencyContact ?? "",
    grade:            employee.grade            ?? "",
    pgcGrade:         employee.pgcGrade         ?? "",
    division:         (employee.division        ?? undefined) as "SUPPORT_SERVICES"|"INFRASTRUCTURE"|"CONSTRUCTION"|"COMMERCIAL" | undefined,
    project:          employee.project          ?? "",
    subDepartment:    employee.subDepartment    ?? "",
    doj:              toDateStr(employee.doj),
    confirmationDate: toDateStr(employee.confirmationDate),
    cnicIssueDate:    toDateStr(employee.cnicIssueDate),
    cnicExpiryDate:   toDateStr(employee.cnicExpiryDate),
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/employees"
          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-brand-purple transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Employees
        </Link>
        <span className="text-muted-foreground/40 text-xs">/</span>
        <Link
          href={`/employees/${employee.id}`}
          className="text-xs font-semibold text-muted-foreground hover:text-brand-purple transition-colors truncate max-w-[160px]"
        >
          {employee.name}
        </Link>
        <span className="text-muted-foreground/40 text-xs">/</span>
        <span className="text-xs font-semibold text-brand-purple">Edit</span>
      </div>

      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-brand-purple">Edit Employee</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Update the details for <strong className="text-brand-purple">{employee.name}</strong>.
        </p>
      </div>

      <EmployeeForm
        mode="edit"
        employeeId={employee.id}
        defaultValues={defaultValues}
      />
    </div>
  )
}
