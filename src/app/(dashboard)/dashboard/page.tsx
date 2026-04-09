import { redirect }   from "next/navigation"
import { subDays, format } from "date-fns"
import { auth }        from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { prisma }      from "@/lib/prisma"
import { PageHeader }  from "@/components/layout/page-header"
import { StatsCards }  from "@/components/dashboard/stats-cards"
import { ActivePeriodBanner } from "@/components/dashboard/active-period-banner"
import { AttendanceBarChart } from "@/components/dashboard/attendance-bar-chart"
import { DailyTrendChart }    from "@/components/dashboard/daily-trend-chart"
import { StatusDonutChart }   from "@/components/dashboard/status-donut-chart"
import { QuickActions }  from "@/components/dashboard/quick-actions"
import { ActivityFeed }  from "@/components/dashboard/activity-feed"
import type { ByDeptData }  from "@/components/dashboard/attendance-bar-chart"
import type { TrendData }   from "@/components/dashboard/daily-trend-chart"
import type { DistData }    from "@/components/dashboard/status-donut-chart"
import type { ActivityEntry } from "@/components/dashboard/activity-feed"
import type { Role } from "@/types"
import { BarChart3 } from "lucide-react"

export const dynamic = "force-dynamic"
export const metadata = { title: "Dashboard — Flexi Time" }

export default async function DashboardPage() {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const session = await auth()
  if (!session?.user) redirect("/login")
  const role = session.user.role as Role

  // ── Today in PKT (UTC+5) ──────────────────────────────────────────────────
  const todayStr  = new Date().toLocaleString("en-CA", { timeZone: "Asia/Karachi" }).split(",")[0]!
  const todayDate = new Date(todayStr + "T00:00:00.000Z")

  // ── Parallel base queries ─────────────────────────────────────────────────
  const [activePeriod, totalEmployees, todayRecords, recentLogs] = await Promise.all([
    prisma.attendancePeriod.findFirst({ where: { isActive: true } }),
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.attendanceRecord.findMany({
      where:  { date: todayDate },
      select: { calculatedStatus: true, overriddenStatus: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take:    10,
      select:  {
        id:         true,
        action:     true,
        entityType: true,
        createdAt:  true,
        user:       { select: { name: true } },
      },
    }),
  ])

  // Today stats
  const todayPresent = todayRecords.filter((r) =>
    ["PRESENT", "SHORT_TIME", "HALF_DAY"].includes(
      (r.overriddenStatus ?? r.calculatedStatus) as string
    )
  ).length
  const todayAbsent = todayRecords.filter((r) =>
    (r.overriddenStatus ?? r.calculatedStatus) === "ABSENT"
  ).length

  // ── Chart data (only if active period) ───────────────────────────────────
  let pendingOverrides = 0
  let byDepartment: ByDeptData[] = []
  let distribution:  DistData[]  = []
  let dailyTrend:    TrendData[]  = []

  if (activePeriod) {
    const thirtyAgo = subDays(new Date(), 30)

    const [pending, periodRecords, trendRaw] = await Promise.all([
      prisma.attendanceRecord.count({
        where: {
          periodId:         activePeriod.id,
          calculatedStatus: "UNMARKED",
          overriddenStatus: null,
        },
      }),
      prisma.attendanceRecord.findMany({
        where:  { periodId: activePeriod.id },
        select: {
          calculatedStatus: true,
          overriddenStatus: true,
          employee: { select: { department: { select: { name: true } } } },
        },
      }),
      prisma.attendanceRecord.findMany({
        where:  { date: { gte: thirtyAgo } },
        select: { date: true, calculatedStatus: true, overriddenStatus: true },
      }),
    ])

    pendingOverrides = pending

    // ── By-department chart ─────────────────────────────────────────────────
    const deptMap = new Map<string, Record<string, number>>()
    for (const r of periodRecords) {
      const dept   = r.employee?.department?.name ?? "Unassigned"
      const status = (r.overriddenStatus ?? r.calculatedStatus) as string
      if (!deptMap.has(dept)) deptMap.set(dept, {})
      const d = deptMap.get(dept)!
      d[status] = (d[status] ?? 0) + 1
    }
    byDepartment = Array.from(deptMap.entries()).map(([dept, counts]) => ({
      dept,
      ...counts,
    } as ByDeptData))

    // ── Status distribution ─────────────────────────────────────────────────
    const statusMap = new Map<string, number>()
    for (const r of periodRecords) {
      const s = (r.overriddenStatus ?? r.calculatedStatus) as string
      statusMap.set(s, (statusMap.get(s) ?? 0) + 1)
    }
    distribution = Array.from(statusMap.entries())
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))

    // ── Daily trend (last 30 days) ──────────────────────────────────────────
    const dayMap = new Map<string, { total: number; present: number }>()
    for (const r of trendRaw) {
      const key = r.date.toISOString().slice(0, 10)
      const s   = (r.overriddenStatus ?? r.calculatedStatus) as string
      if (!dayMap.has(key)) dayMap.set(key, { total: 0, present: 0 })
      const d = dayMap.get(key)!
      d.total++
      if (["PRESENT", "SHORT_TIME", "HALF_DAY"].includes(s)) d.present++
    }
    dailyTrend = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, present }]) => ({
        date:       format(new Date(date + "T12:00:00Z"), "dd MMM"),
        presentPct: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
      }))
  }

  // ── Serialize activity feed ───────────────────────────────────────────────
  const activity: ActivityEntry[] = recentLogs.map((log) => ({
    id:         log.id,
    action:     log.action,
    entityType: log.entityType,
    createdAt:  log.createdAt.toISOString(),
    userName:   log.user.name,
  }))

  // ── Period info (serializable) ────────────────────────────────────────────
  const periodInfo = activePeriod
    ? {
        id:        activePeriod.id,
        label:     activePeriod.label,
        startDate: activePeriod.startDate.toISOString().slice(0, 10),
        endDate:   activePeriod.endDate.toISOString().slice(0, 10),
      }
    : null

  const noChartData = !activePeriod

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session.user.name} — ${new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" })}`}
      />

      {/* Active period banner */}
      <ActivePeriodBanner period={periodInfo} />

      {/* Stats row */}
      <StatsCards
        totalEmployees={totalEmployees}
        todayPresent={todayPresent}
        todayAbsent={todayAbsent}
        pendingOverrides={pendingOverrides}
      />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left: charts (2/3 width) ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          {noChartData ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-border text-center">
              <BarChart3 className="w-10 h-10 text-[#EEC293] mb-3" />
              <p className="font-bold text-[#322E53]">No active period</p>
              <p className="text-sm text-muted-foreground font-medium mt-1 max-w-xs">
                Activate an attendance period to see department charts, daily trends, and status distribution.
              </p>
            </div>
          ) : (
            <>
              <AttendanceBarChart data={byDepartment} />
              <DailyTrendChart    data={dailyTrend}   />
              <StatusDonutChart   data={distribution} />
            </>
          )}
        </div>

        {/* ── Right: actions + activity (1/3 width) ───────────────────────── */}
        <div className="space-y-5">
          <QuickActions
            canUpload={hasPermission(role, "attendance:upload")}
            canReport={hasPermission(role, "reports:read")}
            canAddEmployee={hasPermission(role, "employees:create")}
            activePeriodId={periodInfo?.id ?? null}
          />
          <ActivityFeed logs={activity} />
        </div>
      </div>
    </div>
  )
}
