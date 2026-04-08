import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/shared/page-header"
import {
  Users, Building2, Clock, CheckCircle2, XCircle,
  AlertTriangle, CalendarOff, BarChart3,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// DATA FETCHING
// ─────────────────────────────────────────────────────────────────────────────
async function getDashboardStats() {
  const [
    totalEmployees,
    activeDepts,
    activePeriod,
    statusCounts,
  ] = await Promise.all([
    prisma.employee.count({ where: { isActive: true } }),
    prisma.department.count(),
    prisma.attendancePeriod.findFirst({
      where:   { isActive: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["calculatedStatus"],
      _count: { calculatedStatus: true },
      where: {
        period: { isActive: true },
      },
    }),
  ])

  // Roll up status counts
  const counts = Object.fromEntries(
    statusCounts.map((r) => [r.calculatedStatus, r._count.calculatedStatus])
  ) as Record<string, number>

  return { totalEmployees, activeDepts, activePeriod, counts }
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string
  value: number | string
  icon:  React.ElementType
  color: string
  sub?:  string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-lg bg-slate-800/60`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { totalEmployees, activeDepts, activePeriod, counts } =
    await getDashboardStats()

  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${session.user.name?.split(" ")[0] ?? "Admin"}`}
        description="Here's an overview of the current attendance period."
      />

      {/* ── Period banner ──────────────────────────────────────────────────── */}
      {activePeriod ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-600/10 border border-indigo-600/25 rounded-xl mb-6 text-sm">
          <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-indigo-300 font-medium">Active Period:</span>
          <span className="text-white font-semibold">{activePeriod.label}</span>
          <span className="text-slate-500 ml-auto hidden sm:block text-xs">
            {new Date(activePeriod.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            {" – "}
            {new Date(activePeriod.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 bg-yellow-900/20 border border-yellow-700/30 rounded-xl mb-6 text-sm">
          <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
          <span className="text-yellow-400">No active attendance period. Create one to start processing.</span>
        </div>
      )}

      {/* ── Top stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Active Employees"
          value={totalEmployees}
          icon={Users}
          color="text-blue-400"
          sub={`across ${activeDepts} departments`}
        />
        <StatCard
          label="Total Records"
          value={totalRecords}
          icon={BarChart3}
          color="text-indigo-400"
          sub={activePeriod?.label ?? "no active period"}
        />
        <StatCard
          label="Present"
          value={counts.PRESENT ?? 0}
          icon={CheckCircle2}
          color="text-green-400"
          sub="this period"
        />
        <StatCard
          label="Absent"
          value={counts.ABSENT ?? 0}
          icon={XCircle}
          color="text-red-400"
          sub="this period"
        />
      </div>

      {/* ── Status breakdown ───────────────────────────────────────────────── */}
      {totalRecords > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Status Breakdown — {activePeriod?.label}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: "PRESENT",     label: "Present",     color: "#4ade80" },
              { key: "SHORT_TIME",  label: "Short Time",  color: "#fbbf24" },
              { key: "HALF_DAY",    label: "Half Day",    color: "#fb923c" },
              { key: "ABSENT",      label: "Absent",      color: "#f87171" },
              { key: "LEAVE",       label: "Leave",       color: "#60a5fa" },
              { key: "MISSING_IN",  label: "Missing In",  color: "#c084fc" },
              { key: "MISSING_OUT", label: "Missing Out", color: "#e879f9" },
              { key: "UNMARKED",    label: "Unmarked",    color: "#6b7280" },
            ].map(({ key, label, color }) => (
              <div key={key} className="flex items-center justify-between py-2 px-3 bg-slate-800/40 rounded-lg">
                <span className="text-xs text-slate-400">{label}</span>
                <span className="text-sm font-bold" style={{ color }}>
                  {counts[key] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick actions (placeholder for Phase 3+) ───────────────────────── */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: "/attendance",  icon: Clock,      label: "View Attendance Grid", desc: "Process and override daily records" },
          { href: "/employees",   icon: Users,      label: "Manage Employees",     desc: "View, add, and update employee data" },
          { href: "/reports",     icon: BarChart3,  label: "Export Reports",       desc: "Download CSV or Excel reports" },
        ].map(({ href, icon: Icon, label, desc }) => (
          <a
            key={href}
            href={href}
            className="flex items-start gap-3 p-4 bg-card border border-border rounded-xl hover:border-indigo-600/40 hover:bg-indigo-600/5 transition-colors group"
          >
            <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-indigo-600/20 transition-colors mt-0.5">
              <Icon className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-colors" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
