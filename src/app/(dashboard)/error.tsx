"use client"

import { useEffect } from "react"
import { RefreshCw, Home, AlertTriangle } from "lucide-react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[DashboardError]", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-500" />
      </div>
      <h2 className="text-lg font-bold text-[#322E53] mb-1">Page error</h2>
      <p className="text-sm text-muted-foreground font-medium mb-6 max-w-xs">
        {error.message || "An unexpected error occurred loading this page."}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#322E53] text-white text-sm font-bold hover:bg-[#49426E] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
        <a
          href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-semibold text-[#322E53] hover:bg-[#F5F4F8] transition-colors"
        >
          <Home className="w-4 h-4" />
          Dashboard
        </a>
      </div>
    </div>
  )
}
