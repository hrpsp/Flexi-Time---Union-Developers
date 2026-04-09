"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import {
  Calendar, BarChart3, Users, Loader2, Download, FileSpreadsheet,
  AlertCircle, ChevronRight, RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MultiSelect } from "./multi-select"
import type { SelectOption } from "./multi-select"
import { format } from "date-fns"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PeriodOption { id: string; label: string }
export interface DeptOption   { id: string; name: string; code: number }

interface ReportsShellProps {
  periods:    PeriodOption[]
  departments: DeptOption[]
  canExport:  boolean
}

type ReportType = "daily" | "monthly-summary" | "employee-status"

// Result shapes
interface DailyRow {
  id: string; hcmId: string; name: string; department: string
  inTime: string; outTime: string; workedHours: string
  status: string; note: string
}
interface MonthlySummaryRow {
  hcmId: string; name: string; department: string; designation: string
  workingDays: number; present: number; shortTime: number; halfDay: number
  absent: number; leave: number; missingIn: number; missingOut: number
  unmarked: number; attendancePct: number
}
interface EmployeeStatusRow {
  hcmId: string; name: string; department: string; designation: string
  status: string; doj: string; dol: string; rejoiningDate: string
  totalDays: number | string; reason: string
}
interface MonthlySummaryMeta {
  period:      { label: string; startDate: string; endDate: string }
  workingDays: number
  total:       number
}

// ─────────────────────────────────────────────────────────────────────────────
// Status options for daily report filter
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: SelectOption[] = [
  { value: "PRESENT",     label: "Present",     color: "bg-emerald-500" },
  { value: "SHORT_TIME",  label: "Short Time",  color: "bg-amber-500"   },
  { value: "HALF_DAY",    label: "Half Day",    color: "bg-orange-500"  },
  { value: "ABSENT",      label: "Absent",      color: "bg-red-500"     },
  { value: "LEAVE",       label: "Leave",       color: "bg-blue-500"    },
  { value: "MISSING_IN",  label: "Missing In",  color: "bg-violet-500"  },
  { value: "MISSING_OUT", label: "Missing Out", color: "bg-fuchsia-500" },
  { value: "UNMARKED",    label: "Unmarked",    color: "bg-slate-400"   },
]

const CELL_STATUS: Record<string, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800", SHORT_TIME: "bg-amber-100 text-amber-800",
  HALF_DAY: "bg-orange-100 text-orange-800",  ABSENT: "bg-red-100 text-red-800",
  LEAVE: "bg-blue-100 text-blue-800",         MISSING_IN: "bg-violet-100 text-violet-800",
  MISSING_OUT: "bg-fuchsia-100 text-fuchsia-800", UNMARKED: "bg-slate-100 text-slate-600",
}

// ─────────────────────────────────────────────────────────────────────────────
// Report type cards config
// ─────────────────────────────────────────────────────────────────────────────

const REPORT_TYPES = [
  {
    id:          "daily" as const,
    icon:        Calendar,
    label:       "Daily Attendance",
    description: "All punches for a single date",
  },
  {
    id:          "monthly-summary" as const,
    icon:        BarChart3,
    label:       "Monthly Summary",
    description: "Per-employee status counts for a period",
  },
  {
    id:          "employee-status" as const,
    icon:        Users,
    label:       "Employee Status",
    description: "Active / inactive employees with tenure",
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function today(): string { return format(new Date(), "yyyy-MM-dd") }

function pct(n: number): string {
  return `${n.toFixed(1)}%`
}

function pctColor(n: number): string {
  if (n >= 90) return "text-emerald-700 font-bold"
  if (n >= 75) return "text-amber-700 font-bold"
  if (n >= 50) return "text-orange-700 font-bold"
  return "text-red-700 font-bold"
}

const TH = "px-3 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-[#49426E] whitespace-nowrap"
const TD = "px-3 py-2.5 text-xs text-[#322E53] font-medium border-b border-border"
const TDNum = "px-3 py-2.5 text-xs text-center font-bold border-b border-border"

// ─────────────────────────────────────────────────────────────────────────────
// Main ReportsShell component
// ─────────────────────────────────────────────────────────────────────────────

export function ReportsShell({ periods, departments, canExport }: ReportsShellProps) {
  const [selectedType, setSelectedType] = useState<ReportType>("monthly-summary")

  // Shared state
  const [deptIds,       setDeptIds]       = useState<string[]>([])
  const [generating,    setGenerating]    = useState(false)
  const [exporting,     setExporting]     = useState(false)
  const [hasResults,    setHasResults]    = useState(false)

  // Daily state
  const [dailyDate,     setDailyDate]     = useState(today())
  const [dailyStatuses, setDailyStatuses] = useState<string[]>([])
  const [dailyRows,     setDailyRows]     = useState<DailyRow[]>([])

  // Monthly state
  const [monthPeriodId,  setMonthPeriodId]  = useState(periods[0]?.id ?? "")
  const [monthEmpStatus, setMonthEmpStatus] = useState<"ACTIVE"|"INACTIVE"|"ALL">("ALL")
  const [monthRows,      setMonthRows]      = useState<MonthlySummaryRow[]>([])
  const [monthMeta,      setMonthMeta]      = useState<MonthlySummaryMeta | null>(null)

  // Employee status state
  const [empStatusFilter, setEmpStatusFilter] = useState<"ACTIVE"|"INACTIVE"|"ALL">("ALL")
  const [empDateFrom,     setEmpDateFrom]     = useState("")
  const [empDateTo,       setEmpDateTo]       = useState("")
  const [empStatusRows,   setEmpStatusRows]   = useState<EmployeeStatusRow[]>([])

  // Dept options for MultiSelect
  const deptOptions: SelectOption[] = departments.map((d) => ({
    value: d.id,
    label: `${d.name}`,
  }))

  // ── Generate handlers ──────────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true)
    setHasResults(false)
    try {
      if (selectedType === "daily") {
        const res  = await fetch("/api/reports/daily", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dailyDate, departmentIds: deptIds, statuses: dailyStatuses }),
        })
        const data = await res.json()
        if (!res.ok) { toast.error(data.error ?? "Failed to generate report."); return }
        setDailyRows(data.rows)
        setHasResults(true)

      } else if (selectedType === "monthly-summary") {
        if (!monthPeriodId) { toast.error("Please select a period."); return }
        const res  = await fetch("/api/reports/monthly-summary", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodId: monthPeriodId, departmentIds: deptIds, employeeStatus: monthEmpStatus }),
        })
        const data = await res.json()
        if (!res.ok) { toast.error(data.error ?? "Failed to generate report."); return }
        setMonthRows(data.rows)
        setMonthMeta({ period: data.period, workingDays: data.workingDays, total: data.total })
        setHasResults(true)

      } else {
        const res  = await fetch("/api/reports/employee-status", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ departmentIds: deptIds, status: empStatusFilter, dateFrom: empDateFrom || undefined, dateTo: empDateTo || undefined }),
        })
        const data = await res.json()
        if (!res.ok) { toast.error(data.error ?? "Failed to generate report."); return }
        setEmpStatusRows(data.rows)
        setHasResults(true)
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  // ── Excel export ──────────────────────────────────────────────────────────
  async function handleExcelExport() {
    setExporting(true)
    try {
      const filters: Record<string, unknown> =
        selectedType === "daily"
          ? { date: dailyDate, departmentIds: deptIds, statuses: dailyStatuses }
          : selectedType === "monthly-summary"
            ? { periodId: monthPeriodId, departmentIds: deptIds, employeeStatus: monthEmpStatus }
            : { departmentIds: deptIds, status: empStatusFilter, dateFrom: empDateFrom || undefined, dateTo: empDateTo || undefined }

      const res = await fetch("/api/reports/export/excel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType: selectedType, filters }),
      })
      if (!res.ok) { toast.error("Export failed."); return }

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href     = url
      const cd   = res.headers.get("Content-Disposition") ?? ""
      const fn   = cd.match(/filename="([^"]+)"/)?.[1] ?? "report.xlsx"
      a.download = fn
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Excel file downloaded.")
    } catch {
      toast.error("Export failed.")
    } finally {
      setExporting(false)
    }
  }

  // Reset results when type changes
  function handleTypeChange(t: ReportType) {
    setSelectedType(t)
    setHasResults(false)
    setDeptIds([])
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-5 items-start">

      {/* ── Left panel: report type selector ─────────────────────────────── */}
      <div className="w-56 shrink-0 space-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground px-1 mb-3">
          Report Type
        </p>
        {REPORT_TYPES.map((rt) => {
          const Icon     = rt.icon
          const isActive = selectedType === rt.id
          return (
            <button
              key={rt.id}
              onClick={() => handleTypeChange(rt.id)}
              className={cn(
                "w-full flex items-start gap-3 p-3.5 rounded-2xl border-2 text-left transition-all",
                isActive
                  ? "border-[#322E53] bg-[#322E53] text-white shadow-lg shadow-[#322E53]/20"
                  : "border-border bg-white text-[#322E53] hover:border-[#322E53]/30 hover:bg-[#F5F4F8]"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                isActive ? "bg-white/15" : "bg-[#F5F4F8]"
              )}>
                <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-[#322E53]")} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-extrabold leading-tight", isActive ? "text-white" : "text-[#322E53]")}>
                  {rt.label}
                </p>
                <p className={cn("text-[10px] mt-0.5 leading-tight", isActive ? "text-white/70" : "text-muted-foreground")}>
                  {rt.description}
                </p>
              </div>
              {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/50 shrink-0 mt-0.5" />}
            </button>
          )
        })}
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Filter bar */}
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* ── Daily filters ── */}
            {selectedType === "daily" && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
                    Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={dailyDate}
                    onChange={(e) => setDailyDate(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-border bg-[#F5F4F8] text-sm font-medium
                               text-[#322E53] focus:outline-none focus:ring-2 focus:ring-[#322E53]/20
                               focus:border-[#322E53] transition-colors"
                  />
                </div>
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#49426E]">
                      Department
                    </label>
                    <MultiSelect
                      label="Department" options={deptOptions}
                      selected={deptIds} onChange={setDeptIds}
                      placeholder="All"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#49426E]">
                      Status
                    </label>
                    <MultiSelect
                      label="Status" options={STATUS_OPTIONS}
                      selected={dailyStatuses} onChange={setDailyStatuses}
                      placeholder="All" maxDisplay={2}
                    />
                  </div>
                </div>
              </>
            )}

            {/* ── Monthly Summary filters ── */}
            {selectedType === "monthly-summary" && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
                    Period <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={monthPeriodId}
                    onChange={(e) => setMonthPeriodId(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-border bg-[#F5F4F8] text-sm font-medium
                               text-[#322E53] focus:outline-none focus:ring-2 focus:ring-[#322E53]/20
                               focus:border-[#322E53] transition-colors"
                  >
                    {periods.length === 0
                      ? <option value="">No periods available</option>
                      : periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)
                    }
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#49426E]">
                    Department
                  </label>
                  <MultiSelect
                    label="Department" options={deptOptions}
                    selected={deptIds} onChange={setDeptIds}
                    placeholder="All"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
                    Employee Status
                  </label>
                  <select
                    value={monthEmpStatus}
                    onChange={(e) => setMonthEmpStatus(e.target.value as "ACTIVE"|"INACTIVE"|"ALL")}
                    className="px-3 py-2 rounded-xl border border-border bg-[#F5F4F8] text-sm font-medium
                               text-[#322E53] focus:outline-none focus:ring-2 focus:ring-[#322E53]/20
                               focus:border-[#322E53] transition-colors"
                  >
                    <option value="ALL">All Employees</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="INACTIVE">Inactive Only</option>
                  </select>
                </div>
              </>
            )}

            {/* ── Employee Status filters ── */}
            {selectedType === "employee-status" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#49426E]">
                    Department
                  </label>
                  <MultiSelect
                    label="Department" options={deptOptions}
                    selected={deptIds} onChange={setDeptIds}
                    placeholder="All"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
                    Status
                  </label>
                  <select
                    value={empStatusFilter}
                    onChange={(e) => setEmpStatusFilter(e.target.value as "ACTIVE"|"INACTIVE"|"ALL")}
                    className="px-3 py-2 rounded-xl border border-border bg-[#F5F4F8] text-sm font-medium
                               text-[#322E53] focus:outline-none focus:ring-2 focus:ring-[#322E53]/20
                               focus:border-[#322E53] transition-colors"
                  >
                    <option value="ALL">All</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
                    Date Range (DOJ/DOL)
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="date" value={empDateFrom} onChange={(e) => setEmpDateFrom(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-border bg-[#F5F4F8] text-sm font-medium
                                 text-[#322E53] focus:outline-none focus:ring-2 focus:ring-[#322E53]/20 focus:border-[#322E53]" />
                    <span className="text-muted-foreground text-xs">to</span>
                    <input type="date" value={empDateTo} min={empDateFrom} onChange={(e) => setEmpDateTo(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-border bg-[#F5F4F8] text-sm font-medium
                                 text-[#322E53] focus:outline-none focus:ring-2 focus:ring-[#322E53]/20 focus:border-[#322E53]" />
                  </div>
                </div>
              </>
            )}

            {/* Generate button */}
            <div className="flex items-end gap-2 ml-auto">
              {hasResults && canExport && (
                <button
                  onClick={handleExcelExport}
                  disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#322E53]
                             text-[#322E53] text-sm font-bold hover:bg-[#F5F4F8] transition-colors
                             disabled:opacity-50"
                >
                  {exporting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <FileSpreadsheet className="w-4 h-4" />
                  }
                  Export Excel
                </button>
              )}
              <button
                onClick={handleGenerate}
                disabled={generating || (selectedType === "monthly-summary" && !monthPeriodId)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#322E53] hover:bg-[#49426E]
                           text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {generating
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : hasResults
                    ? <RefreshCw className="w-4 h-4" />
                    : <ChevronRight className="w-4 h-4" />
                }
                {hasResults ? "Refresh" : "Generate Report"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Results ──────────────────────────────────────────────────────── */}
        {generating && (
          <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-border">
            <Loader2 className="w-6 h-6 animate-spin text-[#322E53] mr-3" />
            <span className="text-sm font-semibold text-[#322E53]">Generating report…</span>
          </div>
        )}

        {!generating && hasResults && selectedType === "daily" && (
          <DailyTable rows={dailyRows} date={dailyDate} />
        )}
        {!generating && hasResults && selectedType === "monthly-summary" && monthMeta && (
          <MonthlySummaryTable rows={monthRows} meta={monthMeta} />
        )}
        {!generating && hasResults && selectedType === "employee-status" && (
          <EmployeeStatusTable rows={empStatusRows} />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily Report Table
// ─────────────────────────────────────────────────────────────────────────────

function DailyTable({ rows, date }: { rows: DailyRow[]; date: string }) {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      {/* Table header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-[#F5F4F8]/60">
        <div>
          <span className="text-sm font-extrabold text-[#322E53]">Daily Attendance</span>
          <span className="ml-2 text-xs text-muted-foreground font-medium">
            {date} · {rows.length} records
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No attendance records found for this date and filters." />
      ) : (
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-[#F5F4F8]">
              <tr>
                <th className={TH}>#</th>
                <th className={TH}>HCM ID</th>
                <th className={TH}>Name</th>
                <th className={TH}>Department</th>
                <th className={cn(TH, "text-center")}>IN</th>
                <th className={cn(TH, "text-center")}>OUT</th>
                <th className={cn(TH, "text-center")}>Hours</th>
                <th className={cn(TH, "text-center")}>Status</th>
                <th className={TH}>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/30"}>
                  <td className={TD}><span className="text-muted-foreground text-[10px]">{i+1}</span></td>
                  <td className={TD}><span className="font-mono font-semibold">{r.hcmId}</span></td>
                  <td className={TD}><span className="font-semibold">{r.name}</span></td>
                  <td className={TD}>{r.department}</td>
                  <td className={cn(TD, "text-center font-mono")}>{r.inTime}</td>
                  <td className={cn(TD, "text-center font-mono")}>{r.outTime}</td>
                  <td className={cn(TD, "text-center font-semibold")}>{r.workedHours}</td>
                  <td className={cn(TD, "text-center")}>
                    <span className={cn(
                      "inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold",
                      CELL_STATUS[r.status] ?? "bg-slate-100 text-slate-600"
                    )}>
                      {r.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className={cn(TD, "max-w-[200px] truncate text-muted-foreground italic text-[11px]")}>
                    {r.note || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Monthly Summary Table
// ─────────────────────────────────────────────────────────────────────────────

function MonthlySummaryTable({ rows, meta }: { rows: MonthlySummaryRow[]; meta: MonthlySummaryMeta }) {
  // Totals
  const totals = rows.reduce(
    (acc, r) => ({
      present:   acc.present   + r.present,
      shortTime: acc.shortTime + r.shortTime,
      halfDay:   acc.halfDay   + r.halfDay,
      absent:    acc.absent    + r.absent,
      leave:     acc.leave     + r.leave,
      missingIn: acc.missingIn + r.missingIn,
      missingOut:acc.missingOut+ r.missingOut,
      unmarked:  acc.unmarked  + r.unmarked,
    }),
    { present:0, shortTime:0, halfDay:0, absent:0, leave:0, missingIn:0, missingOut:0, unmarked:0 }
  )
  const totalAttDays  = totals.present + totals.shortTime + totals.halfDay
  const avgPct        = rows.length > 0
    ? Math.round((totalAttDays / (meta.workingDays * rows.length)) * 1000) / 10
    : 0

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-[#F5F4F8]/60">
        <div>
          <span className="text-sm font-extrabold text-[#322E53]">{meta.period.label}</span>
          <span className="ml-2 text-xs text-muted-foreground font-medium">
            {meta.period.startDate} → {meta.period.endDate} · {meta.workingDays} working days · {rows.length} employees
          </span>
        </div>
        {/* Legend */}
        <div className="hidden lg:flex items-center gap-2 text-[10px] font-semibold text-muted-foreground">
          {[
            { abbr:"P",  label:"Present",     cls:"bg-emerald-100 text-emerald-700" },
            { abbr:"ST", label:"Short Time",  cls:"bg-amber-100 text-amber-700" },
            { abbr:"H",  label:"Half Day",    cls:"bg-orange-100 text-orange-700" },
            { abbr:"A",  label:"Absent",      cls:"bg-red-100 text-red-700" },
            { abbr:"L",  label:"Leave",       cls:"bg-blue-100 text-blue-700" },
            { abbr:"MI", label:"Missing In",  cls:"bg-violet-100 text-violet-700" },
            { abbr:"MO", label:"Missing Out", cls:"bg-fuchsia-100 text-fuchsia-700" },
          ].map((s) => (
            <span key={s.abbr} className={cn("px-1.5 py-0.5 rounded font-extrabold", s.cls)} title={s.label}>
              {s.abbr}
            </span>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No employees found for the selected period and filters." />
      ) : (
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm border-collapse" style={{ minWidth: "max-content" }}>
            <thead className="sticky top-0 z-10 bg-[#F5F4F8]">
              <tr>
                <th className={TH}>#</th>
                <th className={TH}>HCM ID</th>
                <th className={cn(TH, "min-w-[160px]")}>Name</th>
                <th className={TH}>Department</th>
                <th className={TH}>Designation</th>
                <th className={cn(TH, "text-center")} title="Working Days">WD</th>
                {/* Status count headers */}
                {[
                  { abbr:"P",  cls:"text-emerald-700", title:"Present"     },
                  { abbr:"ST", cls:"text-amber-700",   title:"Short Time"  },
                  { abbr:"H",  cls:"text-orange-700",  title:"Half Day"    },
                  { abbr:"A",  cls:"text-red-700",     title:"Absent"      },
                  { abbr:"L",  cls:"text-blue-700",    title:"Leave"       },
                  { abbr:"MI", cls:"text-violet-700",  title:"Missing In"  },
                  { abbr:"MO", cls:"text-fuchsia-700", title:"Missing Out" },
                  { abbr:"?",  cls:"text-slate-500",   title:"Unmarked"    },
                ].map((s) => (
                  <th key={s.abbr} className={cn(TH, "text-center", s.cls)} title={s.title}>{s.abbr}</th>
                ))}
                <th className={cn(TH, "text-center")}>Att %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.hcmId} className={i % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/30"}>
                  <td className={TD}><span className="text-muted-foreground text-[10px]">{i+1}</span></td>
                  <td className={TD}><span className="font-mono font-semibold text-xs">{r.hcmId}</span></td>
                  <td className={TD}><span className="font-semibold">{r.name}</span></td>
                  <td className={TD}>{r.department}</td>
                  <td className={cn(TD, "text-muted-foreground text-[11px]")}>{r.designation}</td>
                  <td className={cn(TDNum, "text-[#322E53]")}>{r.workingDays}</td>
                  {/* Counts */}
                  <td className={cn(TDNum, r.present > 0    ? "text-emerald-700" : "text-slate-300")}>{r.present}</td>
                  <td className={cn(TDNum, r.shortTime > 0  ? "text-amber-700"   : "text-slate-300")}>{r.shortTime}</td>
                  <td className={cn(TDNum, r.halfDay > 0    ? "text-orange-700"  : "text-slate-300")}>{r.halfDay}</td>
                  <td className={cn(TDNum, r.absent > 0     ? "text-red-700"     : "text-slate-300")}>{r.absent}</td>
                  <td className={cn(TDNum, r.leave > 0      ? "text-blue-700"    : "text-slate-300")}>{r.leave}</td>
                  <td className={cn(TDNum, r.missingIn > 0  ? "text-violet-700"  : "text-slate-300")}>{r.missingIn}</td>
                  <td className={cn(TDNum, r.missingOut > 0 ? "text-fuchsia-700" : "text-slate-300")}>{r.missingOut}</td>
                  <td className={cn(TDNum, r.unmarked > 0   ? "text-slate-500"   : "text-slate-300")}>{r.unmarked}</td>
                  {/* Att% */}
                  <td className={cn(TDNum, pctColor(r.attendancePct))}>{pct(r.attendancePct)}</td>
                </tr>
              ))}
            </tbody>
            {/* Totals row */}
            <tfoot className="sticky bottom-0 bg-[#322E53] text-white">
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-xs font-extrabold text-right text-white/80">
                  TOTALS ({rows.length} employees)
                </td>
                <td className={cn(TDNum, "border-0 text-white")}>{meta.workingDays}</td>
                <td className={cn(TDNum, "border-0 text-emerald-300 font-extrabold")}>{totals.present}</td>
                <td className={cn(TDNum, "border-0 text-amber-300 font-extrabold")}>{totals.shortTime}</td>
                <td className={cn(TDNum, "border-0 text-orange-300 font-extrabold")}>{totals.halfDay}</td>
                <td className={cn(TDNum, "border-0 text-red-300 font-extrabold")}>{totals.absent}</td>
                <td className={cn(TDNum, "border-0 text-blue-300 font-extrabold")}>{totals.leave}</td>
                <td className={cn(TDNum, "border-0 text-violet-300 font-extrabold")}>{totals.missingIn}</td>
                <td className={cn(TDNum, "border-0 text-fuchsia-300 font-extrabold")}>{totals.missingOut}</td>
                <td className={cn(TDNum, "border-0 text-slate-300 font-extrabold")}>{totals.unmarked}</td>
                <td className={cn(TDNum, "border-0 text-white font-extrabold")}>{pct(avgPct)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Employee Status Table
// ─────────────────────────────────────────────────────────────────────────────

function EmployeeStatusTable({ rows }: { rows: EmployeeStatusRow[] }) {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-[#F5F4F8]/60">
        <span className="text-sm font-extrabold text-[#322E53]">Employee Status Report</span>
        <span className="text-xs text-muted-foreground font-medium">{rows.length} employees</span>
        <span className="ml-auto flex items-center gap-3 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Active: {rows.filter(r => r.status === "ACTIVE").length}
          </span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Inactive: {rows.filter(r => r.status === "INACTIVE").length}
          </span>
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No employees found for the selected filters." />
      ) : (
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm border-collapse" style={{ minWidth: "max-content" }}>
            <thead className="sticky top-0 z-10 bg-[#F5F4F8]">
              <tr>
                <th className={TH}>#</th>
                <th className={TH}>HCM ID</th>
                <th className={cn(TH, "min-w-[160px]")}>Name</th>
                <th className={TH}>Department</th>
                <th className={TH}>Designation</th>
                <th className={cn(TH, "text-center")}>Status</th>
                <th className={TH}>Date of Joining</th>
                <th className={TH}>Date of Leaving</th>
                <th className={TH}>Rejoining Date</th>
                <th className={cn(TH, "text-center")}>Total Days</th>
                <th className={TH}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.hcmId} className={i % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/30"}>
                  <td className={TD}><span className="text-muted-foreground text-[10px]">{i+1}</span></td>
                  <td className={TD}><span className="font-mono font-semibold text-xs">{r.hcmId}</span></td>
                  <td className={TD}><span className="font-semibold">{r.name}</span></td>
                  <td className={TD}>{r.department}</td>
                  <td className={cn(TD, "text-muted-foreground text-[11px]")}>{r.designation}</td>
                  <td className={cn(TD, "text-center")}>
                    <span className={cn(
                      "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border",
                      r.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    )}>
                      {r.status}
                    </span>
                  </td>
                  <td className={cn(TD, "font-mono text-xs")}>{r.doj}</td>
                  <td className={cn(TD, "font-mono text-xs text-muted-foreground")}>{r.dol}</td>
                  <td className={cn(TD, "font-mono text-xs text-muted-foreground")}>{r.rejoiningDate}</td>
                  <td className={cn(TDNum, "font-semibold")}>
                    {typeof r.totalDays === "number" ? r.totalDays.toLocaleString() : r.totalDays}
                  </td>
                  <td className={cn(TD, "text-muted-foreground italic text-[11px] max-w-[200px] truncate")}>
                    {r.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-8 h-8 text-[#EEC293] mb-3" />
      <p className="text-sm font-semibold text-[#322E53]">No Results</p>
      <p className="text-xs text-muted-foreground font-medium mt-1 max-w-xs">{message}</p>
    </div>
  )
}
