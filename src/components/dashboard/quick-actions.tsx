import Link from "next/link"
import { Upload, FileSpreadsheet, UserPlus, ChevronRight } from "lucide-react"

interface QuickActionsProps {
  canUpload:      boolean
  canReport:      boolean
  canAddEmployee: boolean
  activePeriodId: string | null
}

interface ActionItem {
  href:    string
  icon:    React.ElementType
  label:   string
  desc:    string
  show:    boolean
  accent?: boolean
}

export function QuickActions({
  canUpload,
  canReport,
  canAddEmployee,
  activePeriodId,
}: QuickActionsProps) {
  const actions: ActionItem[] = [
    {
      href:    "/attendance",
      icon:    Upload,
      label:   "Upload Attendance",
      desc:    "Import Crystal Report punch data",
      show:    canUpload,
      accent:  true,
    },
    {
      href:    canReport && activePeriodId
                 ? `/reports?period=${activePeriodId}&type=monthly-summary`
                 : "/reports",
      icon:    FileSpreadsheet,
      label:   "Monthly Report",
      desc:    "Generate & export attendance summary",
      show:    canReport,
    },
    {
      href:    "/employees/new",
      icon:    UserPlus,
      label:   "Add Employee",
      desc:    "Create a new employee profile",
      show:    canAddEmployee,
    },
  ].filter((a) => a.show)

  if (!actions.length) return null

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Actions</h3>
      </div>
      <div className="divide-y divide-border">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#F5F4F8] transition-colors group"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              action.accent
                ? "bg-[#322E53] group-hover:bg-[#49426E]"
                : "bg-[#F5F4F8] group-hover:bg-[#E8E6EF]"
            }`}>
              <action.icon className={`w-4 h-4 ${action.accent ? "text-[#EEC293]" : "text-[#49426E]"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#322E53] leading-tight">{action.label}</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">{action.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#322E53] transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
