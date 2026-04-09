import { cn } from "@/lib/utils"

interface EmployeeStatusBadgeProps {
  status:    "ACTIVE" | "INACTIVE"
  className?: string
}

export function EmployeeStatusBadge({ status, className }: EmployeeStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap",
        status === "ACTIVE"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-400 line-through-[status]",
        className
      )}
    >
      <span className={cn(
        "w-1.5 h-1.5 rounded-full shrink-0",
        status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-400"
      )} />
      {status === "ACTIVE" ? "Active" : "Inactive"}
    </span>
  )
}
