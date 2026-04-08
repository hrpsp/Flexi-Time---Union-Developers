import { PageHeader } from "@/components/shared/page-header"
import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Application configuration (Admin only)."
      />
      <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border rounded-xl bg-card/40">
        <Settings className="w-10 h-10 text-slate-600 mb-3" />
        <p className="text-slate-400 font-medium">Coming soon</p>
        <p className="text-slate-600 text-sm mt-1">SMTP config, shift rules, email templates.</p>
      </div>
    </div>
  )
}
