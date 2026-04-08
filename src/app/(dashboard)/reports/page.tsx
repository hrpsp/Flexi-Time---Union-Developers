import { PageHeader } from "@/components/shared/page-header"
import { BarChart3 } from "lucide-react"

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Generate and export attendance summaries."
      />
      <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border rounded-xl bg-card/40">
        <BarChart3 className="w-10 h-10 text-slate-600 mb-3" />
        <p className="text-slate-400 font-medium">Coming in Phase 4</p>
        <p className="text-slate-600 text-sm mt-1">Excel and CSV exports, per-employee summaries.</p>
      </div>
    </div>
  )
}
