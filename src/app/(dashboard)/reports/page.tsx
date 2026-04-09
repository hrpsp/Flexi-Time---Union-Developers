import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { ReportsShell } from "@/components/reports/reports-shell"
import type { PeriodOption, DeptOption } from "@/components/reports/reports-shell"
import type { Role } from "@/types"

export const dynamic = "force-dynamic"
export const metadata = { title: "Reports — Flexi Time" }

export default async function ReportsPage() {
  // ── Auth & permission ──────────────────────────────────────────────────────
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (!hasPermission(session.user.role as Role, "reports:read")) redirect("/dashboard")

  const canExport = hasPermission(session.user.role as Role, "reports:export")

  // ── Fetch periods (newest first) ───────────────────────────────────────────
  const rawPeriods = await prisma.attendancePeriod.findMany({
    orderBy: { startDate: "desc" },
    select: { id: true, label: true },
  })

  const periods: PeriodOption[] = rawPeriods.map((p) => ({
    id:    p.id,
    label: p.label,
  }))

  // ── Fetch departments (alphabetical) ───────────────────────────────────────
  const rawDepts = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  })

  const departments: DeptOption[] = rawDepts.map((d) => ({
    id:   d.id,
    name: d.name,
    code: d.code,
  }))

  return (
    <ReportsShell
      periods={periods}
      departments={departments}
      canExport={canExport}
    />
  )
}
