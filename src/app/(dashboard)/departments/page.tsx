import { PageHeader } from "@/components/shared/page-header"
import { Building2 } from "lucide-react"

export default function DepartmentsPage() {
  return (
    <div>
      <PageHeader
        title="Departments"
        description="Create and manage company departments."
      />
      <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border rounded-xl bg-card/40">
        <Building2 className="w-10 h-10 text-slate-600 mb-3" />
        <p className="text-slate-400 font-medium">Coming in Phase 2</p>
        <p className="text-slate-600 text-sm mt-1">Department CRUD (Admin only).</p>
      </div>
    </div>
  )
}
