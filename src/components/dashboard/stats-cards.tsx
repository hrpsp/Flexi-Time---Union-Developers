import { UserCheck, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label:    string
  value:    number | string
  sub?:     string
  icon:     React.ElementType
  iconBg:   string
  accentBorder?: boolean   // peach bottom border for "live" metrics
}

function StatCard({ label, value, sub, icon: Icon, iconBg, accentBorder }: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-border p-5 flex items-start gap-4 shadow-sm shadow-[#322E53]/5 relative overflow-hidden",
      )}
    >
      {/* Peach bottom border for active/live metrics */}
      {accentBorder && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#EEC293]" />
      )}

      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
        <Icon className="w-5 h-5 text-white" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-extrabold text-[#322E53] mt-0.5 leading-none tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {sub && (
          <p className="text-xs font-medium text-muted-foreground mt-1.5">{sub}</p>
        )}
      </div>
    </div>
  )
}

interface StatsCardsProps {
  totalEmployees:   number
  todayPresent:     number
  todayAbsent:      number
  pendingOverrides: number
}

export function StatsCards({
  totalEmployees,
  todayPresent,
  todayAbsent,
  pendingOverrides,
}: StatsCardsProps) {
  const todayTotal = todayPresent + todayAbsent
  const presentPct = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="Total Employees"
        value={totalEmployees}
        sub="Active headcount"
        icon={UserCheck}
        iconBg="bg-[#322E53]"
      />
      <StatCard
        label="Present Today"
        value={todayPresent}
        sub={todayTotal > 0 ? `${presentPct}% attendance rate` : "No records yet"}
        icon={CheckCircle2}
        iconBg="bg-emerald-600"
        accentBorder
      />
      <StatCard
        label="Absent Today"
        value={todayAbsent}
        sub={todayTotal > 0 ? `${100 - presentPct}% of today's records` : "No records yet"}
        icon={XCircle}
        iconBg="bg-red-500"
        accentBorder
      />
      <StatCard
        label="Pending Overrides"
        value={pendingOverrides}
        sub="Unmarked in active period"
        icon={AlertCircle}
        iconBg="bg-amber-500"
        accentBorder
      />
    </div>
  )
}
