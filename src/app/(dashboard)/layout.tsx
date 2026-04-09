import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayoutClient } from "@/components/layout/dashboard-layout-client"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { name, email, role } = session.user

  return (
    <DashboardLayoutClient
      userName={name  ?? "User"}
      userEmail={email ?? ""}
      userRole={role  ?? "VIEWER"}
    >
      {children}
    </DashboardLayoutClient>
  )
}
