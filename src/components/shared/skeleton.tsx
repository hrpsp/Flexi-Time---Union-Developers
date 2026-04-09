import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Primitive skeleton block
// ─────────────────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-slate-100", className)} />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat-card skeleton (4-up grid)
// ─────────────────────────────────────────────────────────────────────────────

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-border p-5 flex items-start gap-4">
      <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}

export function StatsRowSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Table skeleton
// ─────────────────────────────────────────────────────────────────────────────

export function TableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number
  cols?: number
}) {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 bg-[#F5F4F8] border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex gap-4 px-4 py-3.5 border-b border-border last:border-0",
            i % 2 === 1 ? "bg-[#FAFAFA]" : "bg-white"
          )}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={cn("h-4 flex-1", j === 1 && "flex-[2]")} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Card skeleton (generic)
// ─────────────────────────────────────────────────────────────────────────────

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white rounded-2xl border border-border p-5 space-y-3", className)}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}
