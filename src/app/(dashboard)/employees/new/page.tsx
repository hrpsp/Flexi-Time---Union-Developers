import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { EmployeeForm } from "@/components/employees/employee-form"

export const metadata = { title: "Add Employee — Flexi Time" }

export default async function NewEmployeePage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasPermission(session.user.role, "employees:create")) redirect("/employees")

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
        <span className="text-xs font-semibold text-brand-purple">Add New</span>
      </div>

      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-brand-purple">Add New Employee</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Fill in the details below to create a new employee record.
        </p>
      </div>

      <EmployeeForm mode="create" />
    </div>
  )
}
