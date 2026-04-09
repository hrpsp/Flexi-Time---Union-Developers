import { redirect } from "next/navigation"
import { auth }           from "@/lib/auth"
import { hasPermission }  from "@/lib/rbac"
import { PageHeader }     from "@/components/layout/page-header"
import { SettingsShell }  from "@/components/settings/settings-shell"
import type { Role }      from "@/types"

export const dynamic = "force-dynamic"
export const metadata = { title: "Settings — Flexi Time" }

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (!hasPermission(session.user.role as Role, "settings:manage")) redirect("/dashboard")

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure shifts, departments, email templates, and system preferences."
      />
      <SettingsShell />
    </div>
  )
}
