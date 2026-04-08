import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  // Fetch active period label for topbar
  const activePeriod = await prisma.attendancePeriod.findFirst({
    where:   { isActive: true },
    select:  { label: true },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Sidebar (desktop — fixed) ──────────────────────────────────────── */}
      <div className="hidden md:flex shrink-0">
        <Sidebar
          userRole={session.user.role}
          userName={session.user.name ?? "User"}
          userEmail={session.user.email ?? ""}
        />
      </div>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title="Union Developers"
          activePeriod={activePeriod?.label}
        />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
