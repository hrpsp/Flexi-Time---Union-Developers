import { cn } from "@/lib/utils"
import type { Role } from "@/types"

const ROLE_CONFIG: Record<Role, { label: string; className: string }> = {
  SUPER_ADMIN: {
    label:     "Super Admin",
    className: "bg-[#322E53] text-[#EEC293]",
  },
  ADMIN: {
    label:     "Admin",
    className: "bg-[#49426E] text-white",
  },
  HR_MANAGER: {
    label:     "HR Manager",
    className: "bg-blue-600 text-white",
  },
  HR_EXECUTIVE: {
    label:     "HR Executive",
    className: "bg-teal-600 text-white",
  },
  VIEWER: {
    label:     "Viewer",
    className: "bg-slate-400 text-white",
  },
}

interface RoleBadgeProps {
  role:       Role | string
  className?: string
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const cfg = ROLE_CONFIG[role as Role] ?? { label: role, className: "bg-slate-300 text-slate-800" }
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase whitespace-nowrap",
        cfg.className,
        className
      )}
    >
      {cfg.label}
    </span>
  )
}

export { ROLE_CONFIG }
