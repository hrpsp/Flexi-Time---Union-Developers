"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Server, Database, Users, UserCheck, RefreshCw, Loader2,
  CheckCircle2, XCircle, Clock, Tag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, formatDistanceToNow } from "date-fns"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SystemInfo {
  appVersion:     string
  dbStatus:       "connected" | "error"
  lastSyncAt:     string | null
  totalEmployees: number
  totalUsers:     number
  environment:    string
  generatedAt:    string
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconCls,
}: {
  icon:    React.ElementType
  label:   string
  value:   string | number
  sub?:    string
  iconCls?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
          <p className="text-2xl font-extrabold text-[#322E53] leading-none">{value}</p>
          {sub && <p className="text-xs text-muted-foreground font-medium mt-1">{sub}</p>}
        </div>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconCls ?? "bg-[#F5F4F8]")}>
          <Icon className="w-5 h-5 text-[#49426E]" />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// System Info Tab
// ─────────────────────────────────────────────────────────────────────────────

export function SystemInfoTab() {
  const [info,     setInfo]     = useState<SystemInfo | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)

  const fetchInfo = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res  = await fetch("/api/settings/system-info")
      const data = await res.json()
      if (res.ok) setInfo(data)
      else setError(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchInfo() }, [fetchInfo])

  const lastSync = info?.lastSyncAt
    ? `${format(new Date(info.lastSyncAt), "dd MMM yyyy, HH:mm")} (${formatDistanceToNow(new Date(info.lastSyncAt), { addSuffix: true })})`
    : "Never"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-[#322E53]">System Information</h3>
          <p className="text-sm text-muted-foreground font-medium mt-0.5">Read-only system diagnostics and statistics.</p>
        </div>
        <button
          onClick={fetchInfo}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-semibold text-[#322E53] hover:bg-[#F5F4F8] transition-colors disabled:opacity-50"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#322E53]" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-red-200 text-center">
          <XCircle className="w-9 h-9 text-red-400 mb-3" />
          <p className="font-bold text-[#322E53]">Failed to load system info</p>
          <p className="text-sm text-muted-foreground font-medium mt-1">Check your server connection and try again.</p>
          <button
            onClick={fetchInfo}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-semibold text-[#322E53] hover:bg-[#F5F4F8] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && info && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              icon={Users}
              label="Total Employees"
              value={info.totalEmployees.toLocaleString()}
              iconCls="bg-blue-50"
            />
            <StatCard
              icon={UserCheck}
              label="Total Users"
              value={info.totalUsers.toLocaleString()}
              iconCls="bg-purple-50"
            />
            <StatCard
              icon={Tag}
              label="App Version"
              value={`v${info.appVersion}`}
              sub={info.environment}
              iconCls="bg-[#F5F4F8]"
            />
            <StatCard
              icon={Clock}
              label="Last Sync"
              value={info.lastSyncAt ? format(new Date(info.lastSyncAt), "HH:mm") : "—"}
              sub={info.lastSyncAt ? format(new Date(info.lastSyncAt), "dd MMM yyyy") : "No sync yet"}
              iconCls="bg-amber-50"
            />
          </div>

          {/* Detail rows */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            {[
              {
                label: "Database Connection",
                value: info.dbStatus === "connected" ? "Connected" : "Error",
                icon: Database,
                status: info.dbStatus,
              },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
                <div className="w-8 h-8 rounded-lg bg-[#F5F4F8] flex items-center justify-center shrink-0">
                  <row.icon className="w-4 h-4 text-[#49426E]" />
                </div>
                <p className="flex-1 text-sm font-semibold text-[#322E53]">{row.label}</p>
                <div className="flex items-center gap-1.5">
                  {row.status === "connected"
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : <XCircle      className="w-4 h-4 text-red-500"     />}
                  <span className={cn(
                    "text-sm font-bold",
                    row.status === "connected" ? "text-emerald-600" : "text-red-600"
                  )}>
                    {row.value}
                  </span>
                </div>
              </div>
            ))}

            {/* Static info rows */}
            {[
              { label: "Last Attendance Sync",   value: lastSync },
              { label: "Last Refreshed",          value: format(new Date(info.generatedAt), "dd MMM yyyy, HH:mm:ss") },
              { label: "Runtime Environment",     value: info.environment.toUpperCase() },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
                <div className="w-8 h-8 rounded-lg bg-[#F5F4F8] flex items-center justify-center shrink-0">
                  <Server className="w-4 h-4 text-[#49426E]" />
                </div>
                <p className="flex-1 text-sm font-semibold text-[#322E53]">{row.label}</p>
                <p className="text-sm text-slate-600 font-medium text-right max-w-xs">{row.value}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
