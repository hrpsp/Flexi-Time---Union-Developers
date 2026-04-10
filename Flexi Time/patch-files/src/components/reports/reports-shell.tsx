"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import {
  Calendar, BarChart3, Users, Loader2, Download, FileSpreadsheet,
  AlertCircle, ChevronRight, RefreshCw, FileText, Clock, Building2,
  GitBranch, User, TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MultiSelect } from "./multi-select"
import type { SelectOption } from "./multi-select"
import { format } from "date-fns"
import * as XLSX from "xlsx"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PeriodOption   { id: string; label: string; startDate?: string; endDate?: string }
export interface DeptOption     { id: string; name: string; code: number }
export interface EmployeeOption { id: string; hcmId: string; name: string; department: string }

interface ReportsShellProps {
  periods:     PeriodOption[]
  departments: DeptOption[]
  employees:   EmployeeOption[]
  canExport:   boolean
}

// ── Report type keys (match GET /api/reports ?reportType=) ──────────────────
type NewReportType =
  | "in-out"
  | "absentees"
  | "dept-summary"
  | "dept-summary-regularity"
  | "dept-summary-division"
  | "individual"
  | "overtime"
  | "attendance"

// Legacy report types still handled by existing POST endpoints
type LegacyReportType = "daily" | "monthly-summary" | "employee-status"
type ReportType       = NewReportType | LegacyReportType

// ─────────────────────────────────────────────────────────────────────────────
// Constants
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
  PRESENT:     "bg-emerald-100 text-emerald-800",
  SHORT_TIME:  "bg-amber-100 text-amber-800",
  HALF_DAY:    "bg-orange-100 text-orange-800",
  ABSENT:      "bg-red-100 text-red-800",
  LEAVE:       "bg-blue-100 text-blue-800",
  MISSING_IN:  "bg-violet-100 text-violet-800",
  MISSING_OUT: "bg-fuchsia-100 text-fuchsia-800",
  UNMARKED:    "bg-slate-100 text-slate-600",
  OFF:         "bg-slate-200 text-slate-500",
}

const REPORT_TYPES: Array<{
  id:          ReportType
  icon:        React.ElementType
  label:       string
  description: string
  isNew?:      boolean
}> = [
  {
    id:          "in-out",
    icon:        Calendar,
    label:       "In-Out Report",
    description: "Daily punch records for all employees",
    isNew:       true,
  },
  {
    id:          "absentees",
    icon:        AlertCircle,
    label:       "Absentees",
    description: "Employees with ABSENT status grouped by person",
    isNew:       true,
  },
  {
    id:          "dept-summary",
    icon:        BarChart3,
    label:       "Department Summary",
    description: "Status counts per department",
    isNew:       true,
  },
  {
    id:          "dept-summary-regularity",
    icon:        TrendingUp,
    label:       "Dept Summary + Regularity",
    description: "Department summary with regularity % score",
    isNew:       true,
  },
  {
    id:          "dept-summary-division",
    icon:        GitBranch,
    label:       "Dept Summary (Division Wise)",
    description: "Department summary grouped by division",
    isNew:       true,
  },
  {
    id:          "individual",
    icon:        User,
    label:       "Individual Report",
    description: "Full detail records per selected employee(s)",
    isNew:       true,
  },
  {
    id:          "overtime",
    icon:        Clock,
    label:       "Overtime Report",
    description: "Records where worked hours exceed standard shift",
    isNew:       true,
  },
  {
    id:          "attendance",
    icon:        FileText,
    label:       "Attendance (Monthly Grid)",
    description: "Monthly summary per employee with status counts",
    isNew:       true,
  },
  // Legacy types (kept for backward compatibility)
  {
    id:          "monthly-summary",
    icon:        BarChart3,
    label:       "Monthly Summary (Legacy)",
    description: "Per-employee status counts for a period",
  },
  {
    id:          "employee-status",
    icon:        Users,
    label:       "Employee Status",
    description: "Active / inactive employees with tenure",
  },
]

// Shared CSS helpers
const TH   = "px-3 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-[#49426E] whitespace-nowrap"
const TD   = "px-3 py-2.5 text-xs text-[#322E53] font-medium border-b border-border"
const TDNum= "px-3 py-2.5 text-xs text-center font-bold border-b border-border"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function today(): string { return format(new Date(), "yyyy-MM-dd") }
function pct(n: number): string  { return `${n.toFixed(1)}%` }
function pctColor(n: number): string {
  if (n >= 90) return "text-emerald-700 font-bold"
  if (n >= 75) return "text-amber-700 font-bold"
  if (n >= 50) return "text-orange-700 font-bold"
  return "text-red-700 font-bold"
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ReportsShell component
// ─────────────────────────────────────────────────────────────────────────────

export function ReportsShell({ periods, departments, employees, canExport }: ReportsShellProps) {
  const [selectedType, setSelectedType] = useState<ReportType>("attendance")

  // Shared filters
  const [periodId,      setPeriodId]      = useState(periods[0]?.id ?? "")
  const [fromDate,      setFromDate]      = useState("")
  const [toDate,        setToDate]        = useState("")
  const [deptIds,       setDeptIds]       = useState<string[]>([])
  const [empIds,        setEmpIds]        = useState<string[]>([])
  const [statusFilter,  setStatusFilter]  = useState<string[]>([])
  const [groupType,     setGroupType]     = useState<"admin" | "division" | "department">("department")
  const [category,      setCategory]      = useState("")
  const [empStatus,     setEmpStatus]     = useState<"ACTIVE" | "INACTIVE" | "ALL">("ALL")

  // Legacy-specific state
  const [dailyDate,     setDailyDate]     = useState(today())
  const [monthEmpStatus, setMonthEmpStatus] = useState<"ACTIVE"|"INACTIVE"|"ALL">("ALL")
  const [empDateFrom,   setEmpDateFrom]   = useState("")
  const [empDateTo,     setEmpDateTo]     = useState("")

  // UI state
  const [generating, setGenerating] = useState(false)
  const [exporting,  setExporting]  = useState(false)
  const [hasResults, setHasResults] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [resultRows, setResultRows] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [resultMeta, setResultMeta] = useState<any>({})

  // Legacy report states
  const [dailyRows,     setDailyRows]     = useState<Record<string,unknown>[]>([])
  const [monthRows,     setMonthRows]     = useState<Record<string,unknown>[]>([])
  const [monthMeta,     setMonthMeta]     = useState<Record<string,unknown> | null>(null)
  const [empStatusRows, setEmpStatusRows] = useState<Record<string,unknown>[]>([])

  // MultiSelect options
  const deptOptions: SelectOption[] = departments.map((d) => ({
    value: d.id, label: d.name,
  }))
  const empOptions: SelectOption[] = employees.map((e) => ({
    value: e.id, label: `${e.hcmId} — ${e.name}`,
  }))

  const isNewType = (type: ReportType): type is NewReportType =>
    !["daily", "monthly-summary", "employee-status"].includes(type)

  // ── Build query params for new GET endpoint ──────────────────────────────
  function buildQueryParams(): URLSearchParams {
    const p = new URLSearchParams()
    p.set("reportType", selectedType)
    if (periodId)             p.set("periodId",        periodId)
    if (fromDate)             p.set("fromDate",        fromDate)
    if (toDate)               p.set("toDate",          toDate)
    if (deptIds.length)       p.set("departmentIds",   deptIds.join(","))
    if (empIds.length)        p.set("employeeIds",     empIds.join(","))
    if (statusFilter.length)  p.set("statuses",        statusFilter.join(","))
    if (category)             p.set("category",        category)
    if (empStatus !== "ALL")  p.set("employeeStatus",  empStatus)
    return p
  }

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setHasResults(false)

    try {
      if (isNewType(selectedType)) {
        const params = buildQueryParams()
        const res    = await fetch(`/api/reports?${params}`)
        const data   = await res.json()
        if (!res.ok) { toast.error(data.error ?? "Failed to generate report."); return }
        setResultRows(data.rows ?? [])
        setResultMeta(data)
        setHasResults(true)

      } else if (selectedType === "daily") {
        const res = await fetch("/api/reports/daily", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dailyDate, departmentIds: deptIds, statuses: statusFilter }),
        })
        const data = await res.json()
        if (!res.ok) { toast.error(data.error ?? "Failed."); return }
        setDailyRows(data.rows); setHasResults(true)

      } else if (selectedType === "monthly-summary") {
        if (!periodId) { toast.error("Please select a period."); return }
        const res = await fetch("/api/reports/monthly-summary", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodId, departmentIds: deptIds, employeeStatus: monthEmpStatus }),
        })
        const data = await res.json()
        if (!res.ok) { toast.error(data.error ?? "Failed."); return }
        setMonthRows(data.rows)
        setMonthMeta({ period: data.period, workingDays: data.workingDays, total: data.total })
        setHasResults(true)

      } else {
        // employee-status
        const res = await fetch("/api/reports/employee-status", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ departmentIds: deptIds, status: empStatus, dateFrom: empDateFrom || undefined, dateTo: empDateTo || undefined }),
        })
        const data = await res.json()
        if (!res.ok) { toast.error(data.error ?? "Failed."); return }
        setEmpStatusRows(data.rows); setHasResults(true)
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setGenerating(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, periodId, fromDate, toDate, deptIds, empIds, statusFilter, category, empStatus,
      dailyDate, monthEmpStatus, empDateFrom, empDateTo])

  // ── Excel export ──────────────────────────────────────────────────────────
  async function handleExcelExport() {
    setExporting(true)
    try {
      if (isNewType(selectedType) && resultRows.length > 0) {
        exportToExcel(selectedType, resultRows, resultMeta)
        toast.success("Excel exported.")
        return
      }

      // Legacy export via server
      const filters: Record<string, unknown> =
        selectedType === "daily"
          ? { date: dailyDate, departmentIds: deptIds, statuses: statusFilter }
          : selectedType === "monthly-summary"
            ? { periodId, departmentIds: deptIds, employeeStatus: monthEmpStatus }
            : { departmentIds: deptIds, status: empStatus, dateFrom: empDateFrom || undefined, dateTo: empDateTo || undefined }

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
      toast.success("Excel downloaded.")
    } catch {
      toast.error("Export failed.")
    } finally {
      setExporting(false)
    }
  }

  // ── PDF export (client-side jsPDF) ───────────────────────────────────────
  async function handlePdfExport() {
    setExporting(true)
    try {
      const { default: jsPDF } = await import("jspdf")
      const { default: autoTable } = await import("jspdf-autotable")

      const { columns, rows } = getTableData(selectedType, resultRows, dailyRows, monthRows, empStatusRows)
      const fromLabel = fromDate || resultMeta?.fromDate || ""
      const toLabel   = toDate   || resultMeta?.toDate   || ""
      const dateRange = fromLabel && toLabel ? `${fromLabel} to ${toLabel}` : fromLabel || toLabel || ""

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

      // Header
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Union Developers — Flexi Time", 14, 16)
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      const title = REPORT_TYPES.find((r) => r.id === selectedType)?.label ?? selectedType
      doc.text(`${title}${dateRange ? ` | ${dateRange}` : ""}`, 14, 23)
      doc.text(`Generated: ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`, 14, 29)

      autoTable(doc, {
        head:       [columns],
        body:       rows,
        startY:     34,
        styles:     { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 248, 252] },
        margin:     { top: 34, left: 14, right: 14 },
        didDrawPage: (data: { pageNumber: number; pageCount: number; settings: { margin: { left: number } } }) => {
          // Footer
          const pageSize = doc.internal.pageSize
          doc.setFontSize(7)
          doc.setTextColor(150)
          doc.text(
            `Page ${data.pageNumber}`,
            pageSize.getWidth() / 2,
            pageSize.getHeight() - 7,
            { align: "center" }
          )
          doc.setTextColor(0)
        },
      })

      const filename = `attendance-${selectedType}-${fromLabel || format(new Date(), "yyyy-MM-dd")}.pdf`
      doc.save(filename)
      toast.success("PDF exported.")
    } catch (e) {
      console.error(e)
      toast.error("PDF export failed.")
    } finally {
      setExporting(false)
    }
  }

  function handleTypeChange(t: ReportType) {
    setSelectedType(t)
    setHasResults(false)
    setResultRows([])
    setResultMeta({})
  }

  // ── Effective results ─────────────────────────────────────────────────────
  const effectiveRows: Record<string, unknown>[] =
    isNewType(selectedType)
      ? resultRows
      : selectedType === "daily"
        ? dailyRows
        : selectedType === "monthly-summary"
          ? monthRows
          : empStatusRows

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-5 items-start">

      {/* ── Left panel: report type list ─────────────────────────────────── */}
      <div className="w-56 shrink-0 space-y-1.5">
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
                "w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all",
                isActive
                  ? "border-[#322E53] bg-[#322E53] text-white shadow-lg shadow-[#322E53]/20"
                  : "border-border bg-white text-[#322E53] hover:border-[#322E53]/30 hover:bg-[#F5F4F8]"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                isActive ? "bg-white/15" : "bg-[#F5F4F8]"
              )}>
                <Icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-[#322E53]")} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-extrabold leading-tight", isActive ? "text-white" : "text-[#322E53]")}>
                  {rt.label}
                </p>
                <p className={cn("text-[10px] mt-0.5 leading-tight", isActive ? "text-white/70" : "text-muted-foreground")}>
                  {rt.description}
                </p>
              </div>
              {isActive && <ChevronRight className="w-3 h-3 text-white/50 shrink-0 mt-1" />}
            </button>
          )
        })}
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Filter bar */}
        <div className="bg-white rounded-2xl border border-border p-4 space-y-3">

          {/* ── Period + Date Range ── */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Period (for period-based reports) */}
            {(selectedType === "monthly-summary" || selectedType === "attendance" || selectedType === "overtime" ||
              selectedType === "dept-summary" || selectedType === "dept-summary-regularity") && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
                  Period
                </label>
                <select
                  value={periodId}
                  onChange={(e) => setPeriodId(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-border bg-[#F5F4F8] text-sm font-medium
                             text-[#322E53] focus:outline-none focus:ring-2 focus:ring-[#322E53]/20 focus:border-[#322E53]"
                >
                  {periods.length === 0
                    ? <option value="">No periods available</option>
                    : periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)
                  }
                </select>
              </div>
            )}

            {/* Single date (legacy daily) */}
            {selectedType === "daily" && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
                  Date <span className="text-red-400">*</span>
                </label>
                <input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-border bg-[#F5F4F8] text-sm font-medium
                             text-[#322E53] focus:outline-none focus:ring-2 focus:ring-[#322E53]/20 focus:border-[#322E53]" />
              </div>
            )}

            {/* Date Range (for new types that support it) */}
            {(selectedType === "in-out" || selectedType === "absentees" || selectedType === "individual" ||
              selectedType === "dept-summary-division" || selectedType === "attendance" || selectedType === "overtime") && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
                  Date Range
                </label>
                <div className="flex items-center gap-2">
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-border bg-[#F5F4F8] text-sm font-medium
                               text-[#322E53] focus:outline-none focus:ring-2 focus:ring-[#322E53]/20 focus:border-[#322E53]" />
                  <span className="text-muted-foreground text-xs">to</span>
                  <input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-border bg-[#F5F4F8] text-sm font-medium
                               text-[#322E53] focus:outline-none focus:ring-2 focus:ring-[#322E53]/20 focus:border-[#322E53]" />
                </div>
              </div>
            )}
          </div>

          {/* ── Secondary filters ── */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Department */}
            {selectedType !== "dept-summary-division" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#49426E]">
                  Department
                </label>
                <MultiSelect label="Department" options={deptOptions}
                  selected={deptIds} onChange={setDeptIds} placeholder="All" />
              </div>
            )}

            {/* Employee (for individual report) */}
            {(selectedType === "individual" || selectedType === "in-out") && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#49426E]">
                  Employee
                </label>
                <MultiSelect label="Employee" options={empOptions}
                  selected={empIds} onChange={setEmpIds} placeholder="All" maxDisplay={1} />
              </div>
            )}

            {/* Employee Status filter */}
            {(selectedType === "monthly-summary" || selectedType === "attendance" || selectedType === "employee-status") && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
                  Employee Status
                </label>
                <select
                  value={selectedType === "monthly-summary" ? monthEmpStatus : empStatus}
                  onChange={(e) => {
                    const v = e.target.value as "ACTIVE" | "INACTIVE" | "ALL"
                    selectedType === "monthly-summary" ? setMonthEmpStatus(v) : setEmpStatus(v)
                  }}
                  className="px-3 py-2 rounded-xl border border-border bg-[#F5F4F8] text-sm font-medium
                             text-[#322E53] focus:outline-none focus:ring-2 focus:ring-[#322E53]/20 focus:border-[#322E53]"
                >
                  <option value="ALL">All Employees</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>
            )}

            {/* Category */}
            {(selectedType === "attendance" || selectedType === "in-out" || selectedType === "individual") && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-border bg-[#F5F4F8] text-sm font-medium
                             text-[#322E53] focus:outline-none focus:ring-2 focus:ring-[#322E53]/20 focus:border-[#322E53]"
                >
                  <option value="">Select Category</option>
                  <option value="staff">Staff</option>
                  <option value="worker">Worker</option>
                  <option value="management">Management</option>
                </select>
              </div>
            )}

            {/* Status filter (daily / in-out) */}
            {(selectedType === "daily" || selectedType === "in-out") && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#49426E]">
                  Status
                </label>
                <MultiSelect label="Status" options={STATUS_OPTIONS}
                  selected={statusFilter} onChange={setStatusFilter} placeholder="All" maxDisplay={2} />
              </div>
            )}

            {/* Employee status + DOJ range for employee-status report */}
            {selectedType === "employee-status" && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
                  Date Range (DOJ/DOL)
                </label>
                <div className="flex items-center gap-2">
                  <input type="date" value={empDateFrom} onChange={(e) => setEmpDateFrom(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-border bg-[#F5F4F8] text-sm font-medium
                               text-[#322E53] focus:outline-none" />
                  <span className="text-muted-foreground text-xs">to</span>
                  <input type="date" value={empDateTo} min={empDateFrom} onChange={(e) => setEmpDateTo(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-border bg-[#F5F4F8] text-sm font-medium
                               text-[#322E53] focus:outline-none" />
                </div>
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="flex items-center justify-end gap-2">
            {hasResults && canExport && (
              <>
                <button
                  onClick={handleExcelExport}
                  disabled={exporting || generating}
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
                {isNewType(selectedType) && (
                  <button
                    onClick={handlePdfExport}
                    disabled={exporting || generating}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-600
                               text-red-700 text-sm font-bold hover:bg-red-50 transition-colors
                               disabled:opacity-50"
                  >
                    {exporting
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />
                    }
                    Export PDF
                  </button>
                )}
              </>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating || (selectedType === "monthly-summary" && !periodId)}
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

        {/* ── Results ────────────────────────────────────────────────────────── */}
        {generating && (
          <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-border">
            <Loader2 className="w-6 h-6 animate-spin text-[#322E53] mr-3" />
            <span className="text-sm font-semibold text-[#322E53]">Generating report…</span>
          </div>
        )}

        {/* New report types */}
        {!generating && hasResults && selectedType === "in-out" && (
          <InOutTable rows={resultRows} meta={resultMeta} />
        )}
        {!generating && hasResults && selectedType === "absentees" && (
          <AbsenteesTable rows={resultRows} meta={resultMeta} />
        )}
        {!generating && hasResults && (selectedType === "dept-summary" || selectedType === "dept-summary-regularity") && (
          <DeptSummaryTable rows={resultRows} meta={resultMeta} showRegularity={selectedType === "dept-summary-regularity"} />
        )}
        {!generating && hasResults && selectedType === "dept-summary-division" && (
          <DivisionSummaryTable rows={resultRows} meta={resultMeta} />
        )}
        {!generating && hasResults && selectedType === "individual" && (
          <IndividualTable rows={resultRows} meta={resultMeta} />
        )}
        {!generating && hasResults && selectedType === "overtime" && (
          <OvertimeTable rows={resultRows} meta={resultMeta} />
        )}
        {!generating && hasResults && selectedType === "attendance" && (
          <AttendanceSummaryTable rows={resultRows} meta={resultMeta} />
        )}

        {/* Legacy report types */}
        {!generating && hasResults && selectedType === "daily" && (
          <LegacyDailyTable rows={dailyRows} date={dailyDate} />
        )}
        {!generating && hasResults && selectedType === "monthly-summary" && monthMeta && (
          <LegacyMonthlySummaryTable rows={monthRows} meta={monthMeta} />
        )}
        {!generating && hasResults && selectedType === "employee-status" && (
          <LegacyEmployeeStatusTable rows={empStatusRows} />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Client-side Excel export helper
// ─────────────────────────────────────────────────────────────────────────────

function exportToExcel(reportType: string, rows: Record<string, unknown>[], meta: Record<string, unknown>) {
  const { columns } = getTableData(reportType, rows, [], [], [])
  const dataRows    = rows.map((r) => columns.map((c) => r[c.toLowerCase().replace(/\s+/g, "_")] ?? r[c] ?? ""))

  const wb = XLSX.utils.book_new()
  const wsData = [
    ["Union Developers — Flexi Time"],
    [`${reportType} | Generated: ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`],
    [],
    columns,
    ...dataRows,
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws["!cols"] = columns.map((h) => ({ wch: Math.min(Math.max(h.length + 2, 10), 40) }))
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } },
  ]

  const sheetName = reportType.replace(/-/g, "_").slice(0, 31)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const fromLabel = (meta.fromDate as string) || format(new Date(), "yyyy-MM-dd")
  const toLabel   = (meta.toDate as string)   || format(new Date(), "yyyy-MM-dd")
  const filename  = `attendance-${reportType}-${fromLabel}-${toLabel}.xlsx`
  XLSX.writeFile(wb, filename)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get table columns + body rows for export
// ─────────────────────────────────────────────────────────────────────────────

function getTableData(
  reportType: string,
  newRows:    Record<string, unknown>[],
  dailyRows:  Record<string, unknown>[],
  monthRows:  Record<string, unknown>[],
  empRows:    Record<string, unknown>[],
): { columns: string[]; rows: (string | number)[][] } {
  const rows = newRows.length > 0 ? newRows : (dailyRows.length > 0 ? dailyRows : monthRows.length > 0 ? monthRows : empRows)

  const colMap: Record<string, string[]> = {
    "in-out":                 ["HCM ID", "Name", "Department", "Designation", "Date", "IN", "OUT", "Hours", "Status", "Note"],
    "absentees":              ["HCM ID", "Name", "Department", "Designation", "Absent Days", "Dates"],
    "dept-summary":           ["Dept", "Code", "Employees", "Working Days", "P", "ST", "H", "A", "L", "MI", "MO", "?", "Total"],
    "dept-summary-regularity":["Dept", "Code", "Employees", "Working Days", "P", "ST", "H", "A", "L", "MI", "MO", "?", "Regularity %"],
    "dept-summary-division":  ["Division", "Employees", "Working Days", "P", "ST", "H", "A", "L", "MI", "MO", "?", "Regularity %"],
    "individual":             ["HCM ID", "Name", "Department", "Designation", "Date", "IN", "OUT", "Hours", "Status", "Leave Type", "Note"],
    "overtime":               ["HCM ID", "Name", "Department", "Designation", "Date", "IN", "OUT", "Worked", "Standard", "Overtime"],
    "attendance":             ["HCM ID", "Name", "Department", "Designation", "WD", "P", "ST", "H", "A", "L", "MI", "MO", "?", "Att %"],
    "daily":                  ["HCM ID", "Name", "Department", "IN", "OUT", "Hours", "Status", "Note"],
    "monthly-summary":        ["HCM ID", "Name", "Department", "Designation", "WD", "P", "ST", "H", "A", "L", "MI", "MO", "?", "Att %"],
    "employee-status":        ["HCM ID", "Name", "Department", "Designation", "Status", "DOJ", "DOL", "Rejoining", "Days", "Reason"],
  }

  const columns = colMap[reportType] ?? Object.keys(rows[0] ?? {})

  // Map row objects to column-ordered arrays
  const fieldKeys: Record<string, string[]> = {
    "in-out":                 ["hcmId","name","department","designation","date","inTime","outTime","workedHours","status","note"],
    "absentees":              ["hcmId","name","department","designation","absentCount","dates"],
    "dept-summary":           ["department","code","employees","workingDays","present","shortTime","halfDay","absent","leave","missingIn","missingOut","unmarked","totalRecords"],
    "dept-summary-regularity":["department","code","employees","workingDays","present","shortTime","halfDay","absent","leave","missingIn","missingOut","unmarked","regularity"],
    "dept-summary-division":  ["division","employees","workingDays","present","shortTime","halfDay","absent","leave","missingIn","missingOut","unmarked","regularity"],
    "individual":             ["hcmId","name","department","designation","date","inTime","outTime","workedHours","status","leaveType","note"],
    "overtime":               ["hcmId","name","department","designation","date","inTime","outTime","workedHours","stdHours","overtimeHours"],
    "attendance":             ["hcmId","name","department","designation","workingDays","present","shortTime","halfDay","absent","leave","missingIn","missingOut","unmarked","attendancePct"],
    "daily":                  ["hcmId","name","department","inTime","outTime","workedHours","status","note"],
    "monthly-summary":        ["hcmId","name","department","designation","workingDays","present","shortTime","halfDay","absent","leave","missingIn","missingOut","unmarked","attendancePct"],
    "employee-status":        ["hcmId","name","department","designation","status","doj","dol","rejoiningDate","totalDays","reason"],
  }

  const fields = fieldKeys[reportType]
  const bodyRows = fields
    ? rows.map((r) => fields.map((f) => String(r[f] ?? "")))
    : rows.map((r) => Object.values(r).map(String))

  return { columns, rows: bodyRows }
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Result table components ───────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function TableShell({ title, subtitle, children, rowCount }: {
  title: string; subtitle?: string; rowCount?: number; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-[#F5F4F8]/60">
        <div>
          <span className="text-sm font-extrabold text-[#322E53]">{title}</span>
          {subtitle && <span className="ml-2 text-xs text-muted-foreground font-medium">{subtitle}</span>}
        </div>
        {rowCount !== undefined && (
          <span className="text-xs text-muted-foreground font-medium">{rowCount} rows</span>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-8 h-8 text-[#EEC293] mb-3" />
      <p className="text-sm font-semibold text-[#322E53]">No Results</p>
      <p className="text-xs text-muted-foreground font-medium mt-1 max-w-xs">{message}</p>
    </div>
  )
}

// ── In-Out Table ──────────────────────────────────────────────────────────────
function InOutTable({ rows, meta }: { rows: Record<string, unknown>[]; meta: Record<string, unknown> }) {
  return (
    <TableShell
      title="In-Out Report"
      subtitle={`${meta.fromDate ?? ""} → ${meta.toDate ?? ""}`}
      rowCount={rows.length}
    >
      {rows.length === 0 ? <EmptyState message="No records found." /> : (
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm border-collapse" style={{ minWidth: "max-content" }}>
            <thead className="sticky top-0 z-10 bg-[#F5F4F8]">
              <tr>
                {["#","HCM ID","Name","Department","Date","IN","OUT","Hours","Status","Note"].map((h) => (
                  <th key={h} className={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/30"}>
                  <td className={TD}><span className="text-muted-foreground text-[10px]">{i+1}</span></td>
                  <td className={TD}><span className="font-mono font-semibold text-xs">{r.hcmId as string}</span></td>
                  <td className={TD}><span className="font-semibold">{r.name as string}</span></td>
                  <td className={TD}>{r.department as string}</td>
                  <td className={cn(TD, "font-mono text-xs")}>{r.date as string}</td>
                  <td className={cn(TD, "text-center font-mono")}>{r.inTime as string}</td>
                  <td className={cn(TD, "text-center font-mono")}>{r.outTime as string}</td>
                  <td className={cn(TD, "text-center font-semibold")}>{r.workedHours as string}</td>
                  <td className={cn(TD, "text-center")}>
                    <span className={cn(
                      "inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold",
                      CELL_STATUS[(r.status as string).replace(/\s/g,"_")] ?? "bg-slate-100 text-slate-600"
                    )}>{r.status as string}</span>
                  </td>
                  <td className={cn(TD, "text-muted-foreground italic text-[11px]")}>{(r.note as string) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TableShell>
  )
}

// ── Absentees Table ───────────────────────────────────────────────────────────
function AbsenteesTable({ rows, meta }: { rows: Record<string, unknown>[]; meta: Record<string, unknown> }) {
  return (
    <TableShell
      title="Absentees Report"
      subtitle={`${meta.fromDate ?? ""} → ${meta.toDate ?? ""}`}
      rowCount={rows.length}
    >
      {rows.length === 0 ? <EmptyState message="No absentees found for this date range." /> : (
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm border-collapse" style={{ minWidth: "max-content" }}>
            <thead className="sticky top-0 z-10 bg-[#F5F4F8]">
              <tr>
                {["#","HCM ID","Name","Department","Designation","Absent Days","Absence Dates"].map((h) => (
                  <th key={h} className={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/30"}>
                  <td className={TD}><span className="text-muted-foreground text-[10px]">{i+1}</span></td>
                  <td className={TD}><span className="font-mono font-semibold text-xs">{r.hcmId as string}</span></td>
                  <td className={TD}><span className="font-semibold">{r.name as string}</span></td>
                  <td className={TD}>{r.department as string}</td>
                  <td className={cn(TD, "text-muted-foreground text-[11px]")}>{r.designation as string}</td>
                  <td className={cn(TDNum, "text-red-700 font-extrabold")}>{r.absentCount as number}</td>
                  <td className={cn(TD, "text-[11px] text-muted-foreground max-w-[300px]")}>{r.dates as string}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TableShell>
  )
}

// ── Dept Summary Table ────────────────────────────────────────────────────────
function DeptSummaryTable({ rows, meta, showRegularity }: { rows: Record<string,unknown>[]; meta: Record<string,unknown>; showRegularity: boolean }) {
  return (
    <TableShell
      title={showRegularity ? "Department Summary + Regularity" : "Department Summary"}
      subtitle={`${meta.fromDate ?? ""} → ${meta.toDate ?? ""} · ${meta.workingDays ?? ""} working days`}
      rowCount={rows.length}
    >
      {rows.length === 0 ? <EmptyState message="No department data found." /> : (
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm border-collapse" style={{ minWidth: "max-content" }}>
            <thead className="sticky top-0 z-10 bg-[#F5F4F8]">
              <tr>
                <th className={TH}>Dept</th>
                <th className={cn(TH, "text-center")}>Emps</th>
                <th className={cn(TH, "text-center text-emerald-700")}>P</th>
                <th className={cn(TH, "text-center text-amber-700")}>ST</th>
                <th className={cn(TH, "text-center text-orange-700")}>H</th>
                <th className={cn(TH, "text-center text-red-700")}>A</th>
                <th className={cn(TH, "text-center text-blue-700")}>L</th>
                <th className={cn(TH, "text-center text-violet-700")}>MI</th>
                <th className={cn(TH, "text-center text-fuchsia-700")}>MO</th>
                <th className={cn(TH, "text-center text-slate-500")}>?</th>
                {showRegularity && <th className={cn(TH, "text-center")}>Regularity %</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/30"}>
                  <td className={TD}><span className="font-semibold">{r.department as string}</span></td>
                  <td className={TDNum}>{r.employees as number}</td>
                  <td className={cn(TDNum, (r.present as number) > 0 ? "text-emerald-700" : "text-slate-300")}>{r.present as number}</td>
                  <td className={cn(TDNum, (r.shortTime as number) > 0 ? "text-amber-700" : "text-slate-300")}>{r.shortTime as number}</td>
                  <td className={cn(TDNum, (r.halfDay as number) > 0 ? "text-orange-700" : "text-slate-300")}>{r.halfDay as number}</td>
                  <td className={cn(TDNum, (r.absent as number) > 0 ? "text-red-700" : "text-slate-300")}>{r.absent as number}</td>
                  <td className={cn(TDNum, (r.leave as number) > 0 ? "text-blue-700" : "text-slate-300")}>{r.leave as number}</td>
                  <td className={cn(TDNum, (r.missingIn as number) > 0 ? "text-violet-700" : "text-slate-300")}>{r.missingIn as number}</td>
                  <td className={cn(TDNum, (r.missingOut as number) > 0 ? "text-fuchsia-700" : "text-slate-300")}>{r.missingOut as number}</td>
                  <td className={cn(TDNum, (r.unmarked as number) > 0 ? "text-slate-500" : "text-slate-300")}>{r.unmarked as number}</td>
                  {showRegularity && (
                    <td className={cn(TDNum, pctColor(r.regularity as number))}>{pct(r.regularity as number)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TableShell>
  )
}

// ── Division Summary Table ────────────────────────────────────────────────────
function DivisionSummaryTable({ rows, meta }: { rows: Record<string,unknown>[]; meta: Record<string,unknown> }) {
  return (
    <TableShell
      title="Division-wise Summary"
      subtitle={`${meta.fromDate ?? ""} → ${meta.toDate ?? ""}`}
      rowCount={rows.length}
    >
      {rows.length === 0 ? <EmptyState message="No division data found." /> : (
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm border-collapse" style={{ minWidth: "max-content" }}>
            <thead className="sticky top-0 z-10 bg-[#F5F4F8]">
              <tr>
                {["Division", "Employees", "P", "ST", "H", "A", "L", "MI", "MO", "?", "Regularity %"].map((h) => (
                  <th key={h} className={h === "Division" ? TH : cn(TH, "text-center")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/30"}>
                  <td className={TD}><span className="font-semibold">{(r.division as string).replace(/_/g, " ")}</span></td>
                  <td className={TDNum}>{r.employees as number}</td>
                  <td className={cn(TDNum, "text-emerald-700")}>{r.present as number}</td>
                  <td className={cn(TDNum, "text-amber-700")}>{r.shortTime as number}</td>
                  <td className={cn(TDNum, "text-orange-700")}>{r.halfDay as number}</td>
                  <td className={cn(TDNum, "text-red-700")}>{r.absent as number}</td>
                  <td className={cn(TDNum, "text-blue-700")}>{r.leave as number}</td>
                  <td className={cn(TDNum, "text-violet-700")}>{r.missingIn as number}</td>
                  <td className={cn(TDNum, "text-fuchsia-700")}>{r.missingOut as number}</td>
                  <td className={cn(TDNum, "text-slate-500")}>{r.unmarked as number}</td>
                  <td className={cn(TDNum, pctColor(r.regularity as number))}>{pct(r.regularity as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TableShell>
  )
}

// ── Individual Table ──────────────────────────────────────────────────────────
function IndividualTable({ rows, meta }: { rows: Record<string,unknown>[]; meta: Record<string,unknown> }) {
  return (
    <TableShell
      title="Individual Report"
      subtitle={`${meta.fromDate ?? ""} → ${meta.toDate ?? ""}`}
      rowCount={rows.length}
    >
      {rows.length === 0 ? <EmptyState message="No records. Select at least one employee." /> : (
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm border-collapse" style={{ minWidth: "max-content" }}>
            <thead className="sticky top-0 z-10 bg-[#F5F4F8]">
              <tr>
                {["#","HCM","Name","Department","Date","IN","OUT","Hours","Status","Leave","Note"].map((h) => (
                  <th key={h} className={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/30"}>
                  <td className={TD}><span className="text-muted-foreground text-[10px]">{i+1}</span></td>
                  <td className={TD}><span className="font-mono text-xs font-semibold">{r.hcmId as string}</span></td>
                  <td className={TD}><span className="font-semibold">{r.name as string}</span></td>
                  <td className={TD}>{r.department as string}</td>
                  <td className={cn(TD, "font-mono text-xs")}>{r.date as string}</td>
                  <td className={cn(TD, "text-center font-mono")}>{r.inTime as string}</td>
                  <td className={cn(TD, "text-center font-mono")}>{r.outTime as string}</td>
                  <td className={cn(TD, "text-center font-semibold")}>{r.workedHours as string}</td>
                  <td className={cn(TD, "text-center")}>
                    <span className={cn(
                      "inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold",
                      CELL_STATUS[(r.status as string).toUpperCase().replace(/\s/g,"_")] ?? "bg-slate-100 text-slate-600"
                    )}>{r.status as string}</span>
                  </td>
                  <td className={cn(TD, "text-muted-foreground text-[11px]")}>{(r.leaveType as string) || "—"}</td>
                  <td className={cn(TD, "text-muted-foreground italic text-[11px]")}>{(r.note as string) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TableShell>
  )
}

// ── Overtime Table ────────────────────────────────────────────────────────────
function OvertimeTable({ rows, meta }: { rows: Record<string,unknown>[]; meta: Record<string,unknown> }) {
  const totalOT = rows.reduce((s, r) => s + ((r.overtimeMins as number) ?? 0), 0)
  const fmtMin  = (m: number) => `${Math.floor(m/60)}h ${m%60}m`

  return (
    <TableShell
      title="Overtime Report"
      subtitle={`${meta.fromDate ?? ""} → ${meta.toDate ?? ""} · Std: ${meta.stdMinutes ? fmtMin(meta.stdMinutes as number) : ""}`}
      rowCount={rows.length}
    >
      {rows.length === 0 ? <EmptyState message="No overtime records found." /> : (
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm border-collapse" style={{ minWidth: "max-content" }}>
            <thead className="sticky top-0 z-10 bg-[#F5F4F8]">
              <tr>
                {["#","HCM ID","Name","Department","Date","IN","OUT","Worked","Standard","Overtime"].map((h) => (
                  <th key={h} className={h === "Overtime" ? cn(TH, "text-amber-700") : TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/30"}>
                  <td className={TD}><span className="text-muted-foreground text-[10px]">{i+1}</span></td>
                  <td className={TD}><span className="font-mono font-semibold text-xs">{r.hcmId as string}</span></td>
                  <td className={TD}><span className="font-semibold">{r.name as string}</span></td>
                  <td className={TD}>{r.department as string}</td>
                  <td className={cn(TD, "font-mono text-xs")}>{r.date as string}</td>
                  <td className={cn(TD, "text-center font-mono")}>{r.inTime as string}</td>
                  <td className={cn(TD, "text-center font-mono")}>{r.outTime as string}</td>
                  <td className={cn(TD, "text-center font-semibold")}>{r.workedHours as string}</td>
                  <td className={cn(TD, "text-center text-muted-foreground")}>{r.stdHours as string}</td>
                  <td className={cn(TDNum, "text-amber-700 font-extrabold")}>{r.overtimeHours as string}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-[#322E53] text-white">
              <tr>
                <td colSpan={9} className="px-3 py-2.5 text-xs font-extrabold text-right text-white/80">
                  TOTAL OVERTIME
                </td>
                <td className={cn(TDNum, "border-0 text-amber-300 font-extrabold")}>{fmtMin(totalOT)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </TableShell>
  )
}

// ── Attendance Summary Table (Monthly Grid style) ─────────────────────────────
function AttendanceSummaryTable({ rows, meta }: { rows: Record<string,unknown>[]; meta: Record<string,unknown> }) {
  const totals = rows.reduce(
    (acc, r) => ({
      present:    acc.present    + ((r.present    as number) ?? 0),
      shortTime:  acc.shortTime  + ((r.shortTime  as number) ?? 0),
      halfDay:    acc.halfDay    + ((r.halfDay    as number) ?? 0),
      absent:     acc.absent     + ((r.absent     as number) ?? 0),
      leave:      acc.leave      + ((r.leave      as number) ?? 0),
      missingIn:  acc.missingIn  + ((r.missingIn  as number) ?? 0),
      missingOut: acc.missingOut + ((r.missingOut as number) ?? 0),
      unmarked:   acc.unmarked   + ((r.unmarked   as number) ?? 0),
    }),
    { present:0, shortTime:0, halfDay:0, absent:0, leave:0, missingIn:0, missingOut:0, unmarked:0 }
  )

  return (
    <TableShell
      title={`Attendance — ${meta.periodLabel ?? ""}`}
      subtitle={`${meta.fromDate ?? ""} → ${meta.toDate ?? ""} · ${meta.workingDays ?? ""} working days · ${rows.length} employees`}
      rowCount={rows.length}
    >
      {rows.length === 0 ? <EmptyState message="No attendance data found." /> : (
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
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/30"}>
                  <td className={TD}><span className="text-muted-foreground text-[10px]">{i+1}</span></td>
                  <td className={TD}><span className="font-mono font-semibold text-xs">{r.hcmId as string}</span></td>
                  <td className={TD}><span className="font-semibold">{r.name as string}</span></td>
                  <td className={TD}>{r.department as string}</td>
                  <td className={cn(TD, "text-muted-foreground text-[11px]")}>{r.designation as string}</td>
                  <td className={cn(TDNum, "text-[#322E53]")}>{r.workingDays as number}</td>
                  <td className={cn(TDNum, (r.present    as number)>0?"text-emerald-700":"text-slate-300")}>{r.present    as number}</td>
                  <td className={cn(TDNum, (r.shortTime  as number)>0?"text-amber-700"  :"text-slate-300")}>{r.shortTime  as number}</td>
                  <td className={cn(TDNum, (r.halfDay    as number)>0?"text-orange-700" :"text-slate-300")}>{r.halfDay    as number}</td>
                  <td className={cn(TDNum, (r.absent     as number)>0?"text-red-700"    :"text-slate-300")}>{r.absent     as number}</td>
                  <td className={cn(TDNum, (r.leave      as number)>0?"text-blue-700"   :"text-slate-300")}>{r.leave      as number}</td>
                  <td className={cn(TDNum, (r.missingIn  as number)>0?"text-violet-700" :"text-slate-300")}>{r.missingIn  as number}</td>
                  <td className={cn(TDNum, (r.missingOut as number)>0?"text-fuchsia-700":"text-slate-300")}>{r.missingOut as number}</td>
                  <td className={cn(TDNum, (r.unmarked   as number)>0?"text-slate-500"  :"text-slate-300")}>{r.unmarked   as number}</td>
                  <td className={cn(TDNum, pctColor(r.attendancePct as number))}>{pct(r.attendancePct as number)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-[#322E53] text-white">
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-xs font-extrabold text-right text-white/80">
                  TOTALS ({rows.length} employees)
                </td>
                <td className={cn(TDNum, "border-0 text-white")}>{meta.workingDays as number}</td>
                <td className={cn(TDNum, "border-0 text-emerald-300 font-extrabold")}>{totals.present}</td>
                <td className={cn(TDNum, "border-0 text-amber-300 font-extrabold")}>{totals.shortTime}</td>
                <td className={cn(TDNum, "border-0 text-orange-300 font-extrabold")}>{totals.halfDay}</td>
                <td className={cn(TDNum, "border-0 text-red-300 font-extrabold")}>{totals.absent}</td>
                <td className={cn(TDNum, "border-0 text-blue-300 font-extrabold")}>{totals.leave}</td>
                <td className={cn(TDNum, "border-0 text-violet-300 font-extrabold")}>{totals.missingIn}</td>
                <td className={cn(TDNum, "border-0 text-fuchsia-300 font-extrabold")}>{totals.missingOut}</td>
                <td className={cn(TDNum, "border-0 text-slate-300 font-extrabold")}>{totals.unmarked}</td>
                <td className={cn(TDNum, "border-0 text-white font-extrabold")}>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </TableShell>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy tables (kept unchanged from original reports-shell)
// ─────────────────────────────────────────────────────────────────────────────

function LegacyDailyTable({ rows, date }: { rows: Record<string,unknown>[]; date: string }) {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
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
                {["#","HCM ID","Name","Department","IN","OUT","Hours","Status","Note"].map((h) => (
                  <th key={h} className={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id as string} className={i % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/30"}>
                  <td className={TD}><span className="text-muted-foreground text-[10px]">{i+1}</span></td>
                  <td className={TD}><span className="font-mono font-semibold">{r.hcmId as string}</span></td>
                  <td className={TD}><span className="font-semibold">{r.name as string}</span></td>
                  <td className={TD}>{r.department as string}</td>
                  <td className={cn(TD, "text-center font-mono")}>{r.inTime as string}</td>
                  <td className={cn(TD, "text-center font-mono")}>{r.outTime as string}</td>
                  <td className={cn(TD, "text-center font-semibold")}>{r.workedHours as string}</td>
                  <td className={cn(TD, "text-center")}>
                    <span className={cn(
                      "inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold",
                      CELL_STATUS[r.status as string] ?? "bg-slate-100 text-slate-600"
                    )}>{(r.status as string).replace("_", " ")}</span>
                  </td>
                  <td className={cn(TD, "max-w-[200px] truncate text-muted-foreground italic text-[11px]")}>
                    {(r.note as string) || "—"}
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

function LegacyMonthlySummaryTable({ rows, meta }: { rows: Record<string,unknown>[]; meta: Record<string,unknown> }) {
  const totals = rows.reduce(
    (acc, r) => ({
      present:    acc.present    + ((r.present    as number) ?? 0),
      shortTime:  acc.shortTime  + ((r.shortTime  as number) ?? 0),
      halfDay:    acc.halfDay    + ((r.halfDay    as number) ?? 0),
      absent:     acc.absent     + ((r.absent     as number) ?? 0),
      leave:      acc.leave      + ((r.leave      as number) ?? 0),
      missingIn:  acc.missingIn  + ((r.missingIn  as number) ?? 0),
      missingOut: acc.missingOut + ((r.missingOut as number) ?? 0),
      unmarked:   acc.unmarked   + ((r.unmarked   as number) ?? 0),
    }),
    { present:0, shortTime:0, halfDay:0, absent:0, leave:0, missingIn:0, missingOut:0, unmarked:0 }
  )
  const period = meta.period as { label: string; startDate: string; endDate: string }
  const workingDays = meta.workingDays as number
  const totalAttDays  = totals.present + totals.shortTime + totals.halfDay
  const avgPct        = rows.length > 0 ? Math.round((totalAttDays / (workingDays * rows.length)) * 1000) / 10 : 0

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-[#F5F4F8]/60">
        <div>
          <span className="text-sm font-extrabold text-[#322E53]">{period?.label}</span>
          <span className="ml-2 text-xs text-muted-foreground font-medium">
            {period?.startDate} → {period?.endDate} · {workingDays} working days · {rows.length} employees
          </span>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState message="No employees found." />
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
                <th className={cn(TH, "text-center")}>WD</th>
                {[
                  {abbr:"P",cls:"text-emerald-700"},{abbr:"ST",cls:"text-amber-700"},
                  {abbr:"H",cls:"text-orange-700"}, {abbr:"A",cls:"text-red-700"},
                  {abbr:"L",cls:"text-blue-700"},   {abbr:"MI",cls:"text-violet-700"},
                  {abbr:"MO",cls:"text-fuchsia-700"},{abbr:"?",cls:"text-slate-500"},
                ].map((s) => <th key={s.abbr} className={cn(TH,"text-center",s.cls)}>{s.abbr}</th>)}
                <th className={cn(TH,"text-center")}>Att %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.hcmId as string} className={i % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/30"}>
                  <td className={TD}><span className="text-muted-foreground text-[10px]">{i+1}</span></td>
                  <td className={TD}><span className="font-mono font-semibold text-xs">{r.hcmId as string}</span></td>
                  <td className={TD}><span className="font-semibold">{r.name as string}</span></td>
                  <td className={TD}>{r.department as string}</td>
                  <td className={cn(TD,"text-muted-foreground text-[11px]")}>{r.designation as string}</td>
                  <td className={cn(TDNum,"text-[#322E53]")}>{workingDays}</td>
                  <td className={cn(TDNum,(r.present    as number)>0?"text-emerald-700":"text-slate-300")}>{r.present    as number}</td>
                  <td className={cn(TDNum,(r.shortTime  as number)>0?"text-amber-700"  :"text-slate-300")}>{r.shortTime  as number}</td>
                  <td className={cn(TDNum,(r.halfDay    as number)>0?"text-orange-700" :"text-slate-300")}>{r.halfDay    as number}</td>
                  <td className={cn(TDNum,(r.absent     as number)>0?"text-red-700"    :"text-slate-300")}>{r.absent     as number}</td>
                  <td className={cn(TDNum,(r.leave      as number)>0?"text-blue-700"   :"text-slate-300")}>{r.leave      as number}</td>
                  <td className={cn(TDNum,(r.missingIn  as number)>0?"text-violet-700" :"text-slate-300")}>{r.missingIn  as number}</td>
                  <td className={cn(TDNum,(r.missingOut as number)>0?"text-fuchsia-700":"text-slate-300")}>{r.missingOut as number}</td>
                  <td className={cn(TDNum,(r.unmarked   as number)>0?"text-slate-500"  :"text-slate-300")}>{r.unmarked   as number}</td>
                  <td className={cn(TDNum,pctColor(r.attendancePct as number))}>{pct(r.attendancePct as number)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-[#322E53] text-white">
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-xs font-extrabold text-right text-white/80">
                  TOTALS ({rows.length} employees)
                </td>
                <td className={cn(TDNum,"border-0 text-white")}>{workingDays}</td>
                <td className={cn(TDNum,"border-0 text-emerald-300 font-extrabold")}>{totals.present}</td>
                <td className={cn(TDNum,"border-0 text-amber-300 font-extrabold")}>{totals.shortTime}</td>
                <td className={cn(TDNum,"border-0 text-orange-300 font-extrabold")}>{totals.halfDay}</td>
                <td className={cn(TDNum,"border-0 text-red-300 font-extrabold")}>{totals.absent}</td>
                <td className={cn(TDNum,"border-0 text-blue-300 font-extrabold")}>{totals.leave}</td>
                <td className={cn(TDNum,"border-0 text-violet-300 font-extrabold")}>{totals.missingIn}</td>
                <td className={cn(TDNum,"border-0 text-fuchsia-300 font-extrabold")}>{totals.missingOut}</td>
                <td className={cn(TDNum,"border-0 text-slate-300 font-extrabold")}>{totals.unmarked}</td>
                <td className={cn(TDNum,"border-0 text-white font-extrabold")}>{pct(avgPct)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function LegacyEmployeeStatusTable({ rows }: { rows: Record<string,unknown>[] }) {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-[#F5F4F8]/60">
        <span className="text-sm font-extrabold text-[#322E53]">Employee Status Report</span>
        <span className="text-xs text-muted-foreground font-medium">{rows.length} employees</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState message="No employees found for the selected filters." />
      ) : (
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm border-collapse" style={{ minWidth: "max-content" }}>
            <thead className="sticky top-0 z-10 bg-[#F5F4F8]">
              <tr>
                {["#","HCM ID","Name","Department","Designation","Status","Date of Joining","Date of Leaving","Rejoining Date","Total Days","Reason"].map((h) => (
                  <th key={h} className={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.hcmId as string} className={i % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/30"}>
                  <td className={TD}><span className="text-muted-foreground text-[10px]">{i+1}</span></td>
                  <td className={TD}><span className="font-mono font-semibold text-xs">{r.hcmId as string}</span></td>
                  <td className={TD}><span className="font-semibold">{r.name as string}</span></td>
                  <td className={TD}>{r.department as string}</td>
                  <td className={cn(TD,"text-muted-foreground text-[11px]")}>{r.designation as string}</td>
                  <td className={cn(TD,"text-center")}>
                    <span className={cn(
                      "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border",
                      r.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    )}>{r.status as string}</span>
                  </td>
                  <td className={cn(TD,"font-mono text-xs")}>{r.doj as string}</td>
                  <td className={cn(TD,"font-mono text-xs text-muted-foreground")}>{r.dol as string}</td>
                  <td className={cn(TD,"font-mono text-xs text-muted-foreground")}>{r.rejoiningDate as string}</td>
                  <td className={cn(TDNum,"font-semibold")}>
                    {typeof r.totalDays === "number" ? (r.totalDays as number).toLocaleString() : r.totalDays as string}
                  </td>
                  <td className={cn(TD,"text-muted-foreground italic text-[11px] max-w-[200px] truncate")}>
                    {r.reason as string}
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
