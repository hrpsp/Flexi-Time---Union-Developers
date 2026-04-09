import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { PageHeader } from "@/components/layout/page-header"
import { UserTable } from "@/components/users/user-table"
import type { Role } from "@/types"

export const metadata = { title: "Users — Flexi Time" }

export default async function UsersPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  // Server-side RBAC gate — SUPER_ADMIN and ADMIN only
  if (!hasPermission(session.user.role as Role, "users:read")) {
    redirect("/dashboard")
  }

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Manage system accounts, roles, and access permissions."
      />
      <UserTable />
    </div>
  )
}
