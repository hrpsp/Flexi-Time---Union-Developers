import { StatsRowSkeleton, CardSkeleton, Skeleton } from "@/components/shared/skeleton"

export default function DashboardLoading() {
  return (
    <div>
      {/* Page header skeleton */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      {/* Banner skeleton */}
      <Skeleton className="h-14 w-full rounded-2xl mb-6" />

      {/* Stats */}
      <StatsRowSkeleton />

      {/* Charts + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <CardSkeleton className="h-72" />
          <CardSkeleton className="h-52" />
          <CardSkeleton className="h-52" />
        </div>
        <div className="space-y-5">
          <CardSkeleton className="h-40" />
          <CardSkeleton className="h-96" />
        </div>
      </div>
    </div>
  )
}
