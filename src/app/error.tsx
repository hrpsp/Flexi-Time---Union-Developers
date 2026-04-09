"use client"

import { useEffect } from "react"
import { Clock4, RefreshCw, Home } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[GlobalError]", error)
  }, [error])

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-[#F5F4F8] p-6">
        <div className="text-center max-w-sm">
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#322E53] flex items-center justify-center">
              <Clock4 className="w-5 h-5 text-[#EEC293]" />
            </div>
            <span className="text-xl font-extrabold text-[#322E53] tracking-tight">Flexi Time</span>
          </div>

          <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>

          <h1 className="text-xl font-bold text-[#322E53] mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground font-medium mb-2">
            An unexpected error occurred. Our team has been notified.
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-slate-400 mb-6">Error ID: {error.digest}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#322E53] text-white text-sm font-bold hover:bg-[#49426E] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <a
              href="/dashboard"
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-[#322E53] hover:bg-white transition-colors"
            >
              <Home className="w-4 h-4" />
              Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
