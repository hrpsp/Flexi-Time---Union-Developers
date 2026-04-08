import { PageHeader } from "@/components/shared/page-header"
import { Users } from "lucide-react"

export default function EmployeesPage() {
  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage employee records, designations, and department assignments."
      />
      <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border rounded-xl bg-card/40">
        <Users className="w-10 h-10 text-slate-600 mb-3" />
        <p className="text-slate-400 font-medium">Coming in Phase 2</p>
        <p className="text-slate-600 text-sm mt-1">Employee list, Excel import, and detail views.</p>
      </div>
    </div>
  )
}
