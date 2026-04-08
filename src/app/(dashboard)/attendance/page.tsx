import { PageHeader } from "@/components/shared/page-header"
import { Clock } from "lucide-react"

export default function AttendancePage() {
  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Upload biometric data, view the attendance grid, and process overrides."
      />
      <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border rounded-xl bg-card/40">
        <Clock className="w-10 h-10 text-slate-600 mb-3" />
        <p className="text-slate-400 font-medium">Coming in Phase 3</p>
        <p className="text-slate-600 text-sm mt-1">Attendance grid, Excel upload, cell overrides, and bulk actions.</p>
      </div>
    </div>
  )
}
