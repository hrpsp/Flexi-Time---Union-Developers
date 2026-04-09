import Link from "next/link"
import { Calendar, AlertTriangle, ChevronRight } from "lucide-react"
import { format } from "date-fns"

interface PeriodInfo {
  id:        string
  label:     string
  startDate: string
  endDate:   string
}

interface ActivePeriodBannerProps {
  period: PeriodInfo | null
}

export function ActivePeriodBanner({ period }: ActivePeriodBannerProps) {
  if (period) {
    const startFmt = format(new Date(period.startDate + "T12:00:00Z"), "d MMM")
    const endFmt   = format(new Date(period.endDate   + "T12:00:00Z"), "d MMM yyyy")

    return (
      <div className="flex items-center gap-3 px-4 py-3 mb-6 rounded-2xl bg-[#322E53] text-white">
        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
          <Calendar className="w-4 h-4 text-[#EEC293]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-white/50">Active Period</p>
          <p className="text-sm font-bold text-white leading-tight">
            {period.label}
            <span className="font-normal text-white/60 ml-2">
              ({startFmt} – {endFmt})
            </span>
          </p>
        </div>
        <Link
          href={`/attendance/${period.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-[#EEC293] transition-colors shrink-0"
        >
          View Grid
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 mb-6 rounded-2xl bg-amber-50 border border-amber-200">
      <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-800">No active attendance period</p>
        <p className="text-xs text-amber-600 font-medium">Create and activate a period to start processing attendance.</p>
      </div>
      <Link
        href="/attendance"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-xs font-bold text-white transition-colors shrink-0"
      >
        Create Period
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}
