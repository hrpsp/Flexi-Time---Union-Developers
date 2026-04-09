import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { EmployeeTable } from "@/components/employees/employee-table"

export const metadata = { title: "Employees — Flexi Time" }

export default async function EmployeesPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasPermission(session.user.role, "employees:read")) redirect("/dashboard")

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <EmployeeTable />
    </div>
  )
}
