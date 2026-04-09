"use client"
  import Link from "next/link"
import { Clock4, Home, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F4F8] p-6">
      <div className="text-center max-w-sm">
        {/* Brand mark */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#322E53] flex items-center justify-center">
            <Clock4 className="w-5 h-5 text-[#EEC293]" />
          </div>
          <span className="text-xl font-extrabold text-[#322E53] tracking-tight">Flexi Time</span>
        </div>

        {/* 404 */}
        <div
          className="text-8xl font-extrabold leading-none mb-4 select-none"
          style={{
            background: "linear-gradient(135deg, #322E53 0%, #EEC293 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          404
        </div>

        <h1 className="text-xl font-bold text-[#322E53] mb-2">Page not found</h1>
        <p className="text-sm text-muted-foreground font-medium mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#322E53] text-white text-sm font-bold hover:bg-[#49426E] transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>
          <button
            onClick={() => history.back()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-[#322E53] hover:bg-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}
