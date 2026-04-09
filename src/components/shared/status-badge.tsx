import { cn } from "@/lib/utils"

export type BadgeVariant =
  | "present"
  | "short-time"
  | "half-day"
  | "absent"
  | "leave"
  | "missing-in"
  | "missing-out"
  | "unmarked"
  | "off"
  | "active"
  | "inactive"
  | "default"

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  "present":      "bg-emerald-50  text-emerald-700 border-emerald-200",
  "short-time":   "bg-amber-50    text-amber-700   border-amber-200",
  "half-day":     "bg-orange-50   text-orange-700  border-orange-200",
  "absent":       "bg-red-50      text-red-700     border-red-200",
  "leave":        "bg-blue-50     text-blue-700    border-blue-200",
  "missing-in":   "bg-purple-50   text-purple-700  border-purple-200",
  "missing-out":  "bg-fuchsia-50  text-fuchsia-700 border-fuchsia-200",
  "unmarked":     "bg-slate-100   text-slate-500   border-slate-200",
  "off":          "bg-slate-50    text-slate-400   border-slate-100",
  "active":       "bg-emerald-50  text-emerald-700 border-emerald-200",
  "inactive":     "bg-red-50      text-red-500     border-red-200",
  "default":      "bg-[#F5F4F8]   text-[#49426E]   border-[#E8E6EF]",
}

const VARIANT_LABELS: Partial<Record<BadgeVariant, string>> = {
  "present":     "P",
  "short-time":  "ST",
  "half-day":    "HD",
  "absent":      "A",
  "leave":       "L",
  "missing-in":  "MI",
  "missing-out": "MO",
  "unmarked":    "?",
  "off":         "—",
}

interface StatusBadgeProps {
  variant:  BadgeVariant
  label?:   string         // override default short code
  showFull?: boolean       // show full label text
  className?: string
}

export function StatusBadge({ variant, label, showFull = false, className }: StatusBadgeProps) {
  const FULL_LABELS: Partial<Record<BadgeVariant, string>> = {
    "present":     "Present",
    "short-time":  "Short Time",
    "half-day":    "Half Day",
    "absent":      "Absent",
    "leave":       "Leave",
    "missing-in":  "Missing In",
    "missing-out": "Missing Out",
    "unmarked":    "Unmarked",
    "off":         "Day Off",
    "active":      "Active",
    "inactive":    "Inactive",
  }

  const displayLabel = label ?? (showFull ? FULL_LABELS[variant] : VARIANT_LABELS[variant]) ?? variant

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-2 py-0.5",
        "text-[11px] font-bold leading-none tracking-wide whitespace-nowrap",
        VARIANT_STYLES[variant],
        className
      )}
    >
      {displayLabel}
    </span>
  )
}
