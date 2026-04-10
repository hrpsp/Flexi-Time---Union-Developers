// v3 — time override + employee profile tabs
"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { toast } from "sonner"
import {
  Search, Download, Zap, X, Loader2, ChevronLeft, Users,
  AlertTriangle, RefreshCw, CheckSquare, Square, ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtWorked } from "@/lib/attendance-calc"
import type { AttendanceStatusCode } from "@/lib/attendance-calc"
import { OverrideModal } from "./override-modal"
import type { OverrideTarget, LeaveType } from "./override-modal"
import Link from "next/link"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DayInfo {
  dateStr:    string   // "2025-01-15"
  dayNum:     number   // 15
  dayAbbr:    string   // "Wed"
  isSunday:   boolean
  isSaturday: boolean
}

export interface DeptInfo {
  id:    string
  name:  string
  code:  number
  count: number
}

export interface PeriodInfo {
  id:        string
  label:     string
  startDate: string
  endDate:   string
  isActive:  boolean
}

export interface ShiftInfo {
  name:           string
  presentMinutes: number
  shortTimeMin:   number
  halfDayMin:     number
}

interface RecordRow {
  id:               string
  date:             string
  inTime:           string | null
  outTime:          string | null
  workedMinutes:    number | null
  calculatedStatus: string
  overriddenStatus: string | null
  leaveType:        string | null
  note:             string | null
  effectiveStatus:  string
  isOverridden:     boolean
}

interface EmployeeRow {
  id:          string
  hcmId:       string
  name:        string
  designation: string | null
  department:  { id: string; name: string; code: number }
  records:     RecordRow[]
  recordMap:   Map<string, RecordRow>   // dateStr → record
}

interface GridShellProps {
  period:      PeriodInfo
  days:        DayInfo[]
  departments: DeptInfo[]
  totalCount:  number
  shiftInfo:   ShiftInfo | null
  canOverride: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Cell status styles (dark/saturated for the grid)
// ─────────────────────────────────────────────────────────────────────────────

const CELL: Record<string, { bg: string; text: string; abbr: string; label: string }> = {
  PRESENT:     { bg: "bg-emerald-700", text: "text-white",        abbr: "P",  label: "Present"      },
  SHORT_TIME:  { bg: "bg-amber-600",   text: "text-white",        abbr: "ST", label: "Short Time"   },
  HALF_DAY:    { bg: "bg-orange-600",  text: "text-white",        abbr: "H",  label: "Half Day"     },
  ABSENT:      { bg: "bg-red-700",     text: "text-white",        abbr: "A",  label: "Absent"       },
  LEAVE:       { bg: "bg-blue-700",    text: "text-white",        abbr: "L",  label: "Leave"        },
  MISSING_IN:  { bg: "bg-violet-700",  text: "text-white",        abbr: "MI", label: "Missing In"   },
  MISSING_OUT: { bg: "bg-fuchsia-700", text: "text-white",        abbr: "MO", label: "Missing Out"  },
  UNMARKED:    { bg: "bg-slate-500",   text: "text-white",        abbr: "?",  label: "Unmarked"     },
  OFF:         { bg: "bg-slate-800",   text: "text-slate-600",    abbr: "·",  label: "Off"          },
}

// Stats cards (lighter)
const STAT: Record<string, { bg: string; text: string; border: string; label: string }> = {
  PRESENT:     { bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200",  label: "Present"      },
  SHORT_TIME:  { bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200",    label: "Short Time"   },
  HALF_DAY:    { bg: "bg-orange-50",   text: "text-orange-700",   border: "border-orange-200",   label: "Half Day"     },
  ABSENT:      { bg: "bg-red-50",      text: "text-red-700",      border: "border-red-200",      label: "Absent"       },
  LEAVE:       { bg: "bg-blue-50",     text: "text-blue-700",     border: "border-blue-200",     label: "Leave"        },
  MISSING_IN:  { bg: "bg-violet-50",   text: "text-violet-700",   border: "border-violet-200",   label: "Missing In"   },
  MISSING_OUT: { bg: "bg-fuchsia-50",  text: "text-fuchsia-700",  border: "border-fuchsia-200",  label: "Missing Out"  },
  UNMARKED:    { bg: "bg-slate-100",   text: "text-slate-600",    border: "border-slate-200",    label: "Unmarked"     },
}

const STAT_ORDER = ["PRESENT", "SHORT_TIME", "HALF_DAY", "ABSENT", "LEAVE", "MISSING_IN", "MISSING_OUT", "UNMARKED"]

const BULK_STATUSES: Array<{ value: AttendanceStatusCode; label: string }> = [
  { value: "PRESENT",     label: "Present"      },
  { value: "SHORT_TIME",  label: "Short Time"   },
  { value: "HALF_DAY",    label: "Half Day"     },
  { value: "ABSENT",      label: "Absent"       },
  { value: "LEAVE",       label: "Leave"        },
  { value: "MISSING_IN",  label: "Missing In"   },
  { value: "MISSING_OUT", label: "Missing Out"  },
  { value: "OFF",         label: "Off"          },
]

const LEAVE_TYPES = [
  { value: "ANNUAL",         label: "Annual" },
  { value: "SICK",           label: "Sick" },
  { value: "CASUAL",         label: "Casual" },
  { value: "EMERGENCY",      label: "Emergency" },
  { value: "UNPAID",         label: "Unpaid" },
  { value: "WORK_FROM_HOME", label: "WFH" },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(ds: string) {
  try {
    return new Date(ds + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    })
  } catch { return ds }
}

function buildRecordMap(records: RecordRow[]): Map<string, RecordRow> {
  const m = new Map<string, RecordRow>()
  for (const r of records) m.set(r.date, r)
  return m
}

// ─────────────────────────────────────────────────────────────────────────────
// GridShell (main client component)
// ─────────────────────────────────────────────────────────────────────────────

export function GridShell({
  period,
  days,
  departments,
  totalCount,
  shiftInfo,
  canOverride,
}: GridShellProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedDeptId,  setSelectedDeptId]  = useState<string | null>(null)
  const [search,          setSearch]          = useState("")
  const [employees,       setEmployees]       = useState<EmployeeRow[]>([])
  const [stats,           setStats]           = useState<Record<string, number>>({})
  const [loading,         setLoading]         = useState(true)
  const [overrideTarget,  setOverrideTarget]  = useState<OverrideTarget | null>(null)
  const [overrideOpen,    setOverrideOpen]    = useState(false)

  // ── Bulk state ────────────────────────────────────────────────────────────
  const [showBulk,        setShowBulk]        = useState(false)
  const [bulkStatus,      setBulkStatus]      = useState<AttendanceStatusCode>("ABSENT")
  const [bulkLeaveType,   setBulkLeaveType]   = useState<LeaveType | null>(null)
  const [bulkNote,        setBulkNote]        = useState("")
  const [bulkEmptyOnly,   setBulkEmptyOnly]   = useState(true)   // Apply to Empty Only
  const [bulkApplyAll,    setBulkApplyAll]    = useState(false)  // Apply to ALL dates in period
  const [bulking,         setBulking]         = useState(false)

  // ── Row selection ─────────────────────────────────────────────────────────
  const [selectedEmpIds,  setSelectedEmpIds]  = useState<Set<string>>(new Set())

  // ── Dept auto-fill popover ────────────────────────────────────────────────
  const [autofillDept,    setAutofillDept]    = useState<{ id: string; name: string } | null>(null)
  const [autofillStatus,  setAutofillStatus]  = useState<AttendanceStatusCode>("ABSENT")
  const [autofillingDept, setAutofillingDept] = useState(false)

  // ── Dept select dropdown ──────────────────────────────────────────────────
  const [showDeptSelect,  setShowDeptSelect]  = useState(false)
  const deptSelectRef = useRef<HTMLDivElement>(null)

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Selection computed values ─────────────────────────────────────────────
  const allSelected  = employees.length > 0 && employees.every((e) => selectedEmpIds.has(e.id))
  const someSelected = selectedEmpIds.size > 0

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedEmpIds(new Set())
    } else {
      setSelectedEmpIds(new Set(employees.map((e) => e.id)))
    }
  }

  function toggleEmployee(empId: string) {
    setSelectedEmpIds((prev) => {
      const next = new Set(prev)
      if (next.has(empId)) next.delete(empId)
      else next.add(empId)
      return next
    })
  }

  function selectByDept(deptId: string) {
    const deptEmpIds = employees
      .filter((e) => e.department.id === deptId)
      .map((e) => e.id)
    setSelectedEmpIds(new Set(deptEmpIds))
    setShowDeptSelect(false)
  }

  // Close dept dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (deptSelectRef.current && !deptSelectRef.current.contains(e.target as Node)) {
        setShowDeptSelect(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Clear selection when employees list changes
  useEffect(() => {
    setSelectedEmpIds(new Set())
  }, [selectedDeptId, search])

  // ── Group employees by department ─────────────────────────────────────────
  const empsByDept = useMemo(() => {
    if (selectedDeptId) {
      const dept = departments.find((d) => d.id === selectedDeptId)
      return [{ dept: dept ?? null, emps: employees }]
    }
    // Group by dept preserving sidebar order
    const deptMap = new Map<string, EmployeeRow[]>()
    for (const emp of employees) {
      const id = emp.department.id
      if (!deptMap.has(id)) deptMap.set(id, [])
      deptMap.get(id)!.push(emp)
    }
    const groups: Array<{ dept: DeptInfo | null; emps: EmployeeRow[] }> = []
    const knownDeptIds = new Set(departments.map((d) => d.id))
    for (const dept of departments) {
      const emps = deptMap.get(dept.id)
      if (emps && emps.length > 0) groups.push({ dept, emps })
    }
    // Employees whose dept isn't in the sidebar list
    const unknownEmps = employees.filter((e) => !knownDeptIds.has(e.department.id))
    if (unknownEmps.length > 0) groups.push({ dept: null, emps: unknownEmps })
    return groups
  }, [employees, departments, selectedDeptId])

  // ── Fetch records ─────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async (deptId: string | null, q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (deptId) params.set("departmentId", deptId)
      if (q)      params.set("search", q)

      const res  = await fetch(`/api/attendance/${period.id}/records?${params}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed to load records."); return }

      const rows: EmployeeRow[] = (data.employees as Omit<EmployeeRow, "recordMap">[]).map((e) => ({
        ...e,
        recordMap: buildRecordMap(e.records),
      }))
      setEmployees(rows)
      setStats(data.stats ?? {})
    } catch {
      toast.error("Network error loading attendance records.")
    } finally {
      setLoading(false)
    }
  }, [period.id])

  useEffect(() => {
    fetchRecords(selectedDeptId, search)
  }, [fetchRecords, selectedDeptId])   // search handled via debounce below

  // Debounced search
  function handleSearchChange(val: string) {
    setSearch(val)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => fetchRecords(selectedDeptId, val), 350)
  }

  // ── Department selection ─────────────────────────────────────────────────
  function handleDeptSelect(id: string | null) {
    setSelectedDeptId(id)
    setSearch("")
    setShowBulk(false)
  }

  // ── Export CSV ────────────────────────────────────────────────────────────
  function handleExportCSV() {
    const headers = ["#", "Employee", "Code", "Designation", "Department", ...days.map((d) => d.dateStr)]
    const rows = employees.map((emp, i) => [
      i + 1,
      `"${emp.name}"`,
      emp.hcmId,
      `"${emp.designation ?? ""}"`,
      `"${emp.department?.name ?? ""}"`,
      ...days.map((d) => {
        if (d.isSunday) return "OFF"
        const rec = emp.recordMap.get(d.dateStr)
        if (!rec) return ""
        return CELL[rec.effectiveStatus]?.abbr ?? rec.effectiveStatus
      }),
    ])
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = `${period.label.replace(/\s+/g, "_")}_attendance.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Override cell click ───────────────────────────────────────────────────
  function handleCellClick(emp: EmployeeRow, rec: RecordRow) {
    if (!canOverride) return
    setOverrideTarget({
      record:   { ...rec },
      employee: { id: emp.id, name: emp.name, hcmId: emp.hcmId, designation: emp.designation },
    })
    setOverrideOpen(true)
  }

  // Update record in local state after save
  function handleOverrideSaved(
    recordId: string,
    updated: {
      overriddenStatus: string | null
      leaveType:        string | null
      note:             string | null
      isOverridden:     boolean
      effectiveStatus:  string
      inTime:           string | null
      outTime:          string | null
      workedMinutes:    number | null
    }
  ) {
    setEmployees((prev) =>
      prev.map((emp) => {
        const recIdx = emp.records.findIndex((r) => r.id === recordId)
        if (recIdx === -1) return emp

        const oldRec = emp.records[recIdx]
        const newRec = { ...oldRec, ...updated }
        const newRecords = [...emp.records]
        newRecords[recIdx] = newRec

        const newMap = new Map(emp.recordMap)
        newMap.set(newRec.date, newRec)

        return { ...emp, records: newRecords, recordMap: newMap }
      })
    )
    // Recompute stats
    setStats((prev) => {
      const next = { ...prev }
      const target = employees.flatMap((e) => e.records).find((r) => r.id === recordId)
      if (target) {
        const oldStatus = target.effectiveStatus
        const newStatus = updated.effectiveStatus
        if (oldStatus !== newStatus) {
          next[oldStatus] = Math.max(0, (next[oldStatus] ?? 0) - 1)
          next[newStatus] = (next[newStatus] ?? 0) + 1
        }
      }
      return next
    })
  }

  // ── Bulk override (for selected employees) ────────────────────────────────
  async function handleBulkApply() {
    const targetEmpIds = someSelected ? [...selectedEmpIds] : employees.map((e) => e.id)
    if (targetEmpIds.length === 0) return
    setBulking(true)
    try {
      const body: Record<string, unknown> = {
        employeeIds: targetEmpIds,
        periodId:    period.id,
        status:      bulkStatus,
        leaveType:   bulkStatus === "LEAVE" ? bulkLeaveType : null,
        note:        bulkNote || null,
        emptyOnly:   bulkEmptyOnly,
      }
      // If NOT applying to all period dates, restrict to visible (non-Sunday) dates
      if (!bulkApplyAll) {
        body.dates = days.filter((d) => !d.isSunday).map((d) => d.dateStr)
      }

      const res  = await fetch("/api/attendance/bulk-override", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Bulk action failed."); return }

      const label = someSelected ? `${selectedEmpIds.size} selected employee(s)` : `${employees.length} employee(s)`
      toast.success(`Bulk override applied to ${data.updated} record(s) across ${label}.`)
      setShowBulk(false)
      setSelectedEmpIds(new Set())
      fetchRecords(selectedDeptId, search)
    } catch {
      toast.error("Network error.")
    } finally {
      setBulking(false)
    }
  }

  // ── Dept auto-fill ────────────────────────────────────────────────────────
  async function handleAutofillConfirm() {
    if (!autofillDept) return
    const deptEmpIds = employees
      .filter((e) => e.department.id === autofillDept.id)
      .map((e) => e.id)
    if (deptEmpIds.length === 0) return
    setAutofillingDept(true)
    try {
      const res = await fetch("/api/attendance/bulk-override", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          employeeIds: deptEmpIds,
          periodId:    period.id,
          status:      autofillStatus,
          emptyOnly:   true,       // auto-fill always uses emptyOnly
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Auto-fill failed."); return }
      toast.success(`Auto-filled ${data.updated} empty slot(s) in ${autofillDept.name}.`)
      setAutofillDept(null)
      fetchRecords(selectedDeptId, search)
    } catch {
      toast.error("Network error.")
    } finally {
      setAutofillingDept(false)
    }
  }

  // ── Computed values ───────────────────────────────────────────────────────
  const selectedDept = departments.find((d) => d.id === selectedDeptId)
  const displayName  = selectedDept?.name ?? "All Departments"
  const displayCount = selectedDept?.count ?? totalCount

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        className="-m-6 flex overflow-hidden bg-white"
        style={{ height: "calc(100vh - 60px)" }}
      >
        {/* ── Left Sidebar ───────────────────────────────────────────────── */}
        <aside className="w-52 shrink-0 flex flex-col border-r border-border bg-white">
          {/* Back link */}
          <div className="px-3 py-3 border-b border-border shrink-0">
            <Link
              href="/attendance"
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground
                         hover:text-[#322E53] transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Attendance
            </Link>
          </div>

          {/* Period info */}
          <div className="px-4 py-3 border-b border-border shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Period</p>
            <p className="text-sm font-extrabold text-[#322E53] leading-tight">{period.label}</p>
            {period.isActive && (
              <span className="mt-1 inline-block px-1.5 py-0.5 rounded-full bg-emerald-50
                               text-emerald-700 text-[9px] font-extrabold border border-emerald-200">
                ACTIVE
              </span>
            )}
          </div>

          {/* Department list */}
          <div className="flex-1 overflow-y-auto py-2">
            {/* All departments */}
            <button
              onClick={() => handleDeptSelect(null)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors",
                selectedDeptId === null
                  ? "bg-[#322E53] text-white"
                  : "hover:bg-[#F5F4F8] text-[#322E53]"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-semibold truncate">All Departments</span>
              </div>
              <span className={cn(
                "text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ml-1",
                selectedDeptId === null
                  ? "bg-white/20 text-white"
                  : "bg-[#F5F4F8] text-[#322E53]"
              )}>
                {totalCount}
              </span>
            </button>

            {/* Individual departments */}
            {departments.map((dept) => (
              <button
                key={dept.id}
                onClick={() => handleDeptSelect(dept.id)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors",
                  selectedDeptId === dept.id
                    ? "bg-[#322E53] text-white"
                    : "hover:bg-[#F5F4F8] text-[#322E53]"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn(
                    "text-[9px] font-bold shrink-0 w-5 text-center",
                    selectedDeptId === dept.id ? "text-white/60" : "text-muted-foreground"
                  )}>
                    {dept.code}
                  </span>
                  <span className="text-xs font-semibold truncate">{dept.name}</span>
                </div>
                <span className={cn(
                  "text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ml-1",
                  selectedDeptId === dept.id
                    ? "bg-white/20 text-white"
                    : "bg-[#F5F4F8] text-[#322E53]"
                )}>
                  {dept.count}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* ── Main Content ───────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Top bar */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-white shrink-0">
            {/* Dept + shift info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-[#322E53] truncate">{displayName}</h2>
                <span className="text-xs text-muted-foreground font-medium shrink-0">
                  {loading ? "…" : `${employees.length} employees`}
                </span>
                {someSelected && (
                  <span className="px-2 py-0.5 rounded-full bg-[#322E53] text-white text-[10px] font-extrabold shrink-0">
                    {selectedEmpIds.size} selected
                  </span>
                )}
              </div>
              {shiftInfo && (
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  Shift: {shiftInfo.name} · P≥{Math.floor(shiftInfo.presentMinutes/60)}h{shiftInfo.presentMinutes%60 > 0 ? `${shiftInfo.presentMinutes%60}m` : ""} ST≥{Math.floor(shiftInfo.shortTimeMin/60)}h{shiftInfo.shortTimeMin%60 > 0 ? `${shiftInfo.shortTimeMin%60}m` : ""}
                </p>
              )}
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border
                            bg-[#F5F4F8] text-sm w-44 shrink-0">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search employee…"
                className="flex-1 bg-transparent outline-none text-xs font-medium text-[#322E53]
                           placeholder-slate-400 min-w-0"
              />
              {search && (
                <button onClick={() => handleSearchChange("")}>
                  <X className="w-3 h-3 text-muted-foreground hover:text-[#322E53]" />
                </button>
              )}
            </div>

            {/* Select by Department dropdown */}
            {canOverride && departments.length > 0 && (
              <div className="relative shrink-0" ref={deptSelectRef}>
                <button
                  onClick={() => setShowDeptSelect((v) => !v)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors",
                    showDeptSelect
                      ? "bg-[#322E53] text-white border-[#322E53]"
                      : "border-border text-[#322E53] hover:bg-[#F5F4F8]"
                  )}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Select by Dept
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showDeptSelect && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl
                                  border border-border shadow-lg z-50 overflow-hidden py-1">
                    <button
                      onClick={() => { setSelectedEmpIds(new Set(employees.map((e) => e.id))); setShowDeptSelect(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold
                                 text-[#322E53] hover:bg-[#F5F4F8] text-left"
                    >
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      All visible employees
                    </button>
                    <div className="my-1 border-t border-border" />
                    {departments.map((dept) => (
                      <button
                        key={dept.id}
                        onClick={() => selectByDept(dept.id)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2
                                   text-xs font-semibold text-[#322E53] hover:bg-[#F5F4F8] text-left"
                      >
                        <span className="truncate">{dept.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{dept.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              disabled={loading || employees.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border
                         text-xs font-semibold text-[#322E53] hover:bg-[#F5F4F8] transition-colors
                         disabled:opacity-40 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            {/* Bulk Actions */}
            {canOverride && (
              <button
                onClick={() => setShowBulk((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shrink-0",
                  showBulk
                    ? "bg-[#322E53] text-white"
                    : "border border-[#322E53] text-[#322E53] hover:bg-[#F5F4F8]"
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                {someSelected ? `Mark ${selectedEmpIds.size}` : "Bulk Actions"}
              </button>
            )}

            {/* Period label */}
            <div className="text-right shrink-0 hidden lg:block">
              <p className="text-[10px] font-bold text-muted-foreground">{period.label}</p>
              <p className="text-[9px] text-muted-foreground">
                {fmtDate(period.startDate)} – {fmtDate(period.endDate)}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border bg-white shrink-0 overflow-x-auto">
            {STAT_ORDER.map((key) => {
              const s = STAT[key]
              const count = stats[key] ?? 0
              return (
                <div
                  key={key}
                  className={cn(
                    "flex flex-col items-center px-3.5 py-2 rounded-xl border shrink-0",
                    s.bg, s.border
                  )}
                  style={{ minWidth: "72px" }}
                >
                  <span className={cn("text-lg font-extrabold leading-none", s.text)}>{count}</span>
                  <span className={cn("text-[9px] font-bold mt-0.5 whitespace-nowrap", s.text, "opacity-80")}>
                    {s.label}
                  </span>
                </div>
              )
            })}
            <div className="flex-1" />
            {someSelected && (
              <button
                onClick={() => setSelectedEmpIds(new Set())}
                className="flex items-center gap-1 text-xs font-semibold text-muted-foreground
                           hover:text-[#322E53] transition-colors shrink-0"
              >
                <X className="w-3 h-3" />
                Clear selection
              </button>
            )}
            {loading && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium shrink-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading…
              </div>
            )}
          </div>

          {/* ── Bulk Action Bar (shows when ≥1 selected OR showBulk is true) ── */}
          {showBulk && canOverride && (
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-amber-200 bg-amber-50 shrink-0 flex-wrap">
              <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-xs font-bold text-amber-800 shrink-0">
                Bulk Mark —{" "}
                {someSelected
                  ? `${selectedEmpIds.size} selected employee(s)`
                  : `all ${employees.length} employee(s)`}
              </span>

              {/* Status dropdown */}
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as AttendanceStatusCode)}
                className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs
                           font-semibold text-[#322E53] focus:outline-none"
              >
                {BULK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>

              {/* Leave type */}
              {bulkStatus === "LEAVE" && (
                <select
                  value={bulkLeaveType ?? ""}
                  onChange={(e) => setBulkLeaveType((e.target.value as LeaveType) || null)}
                  className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs
                             font-semibold text-[#322E53] focus:outline-none"
                >
                  <option value="">Select leave type…</option>
                  {LEAVE_TYPES.map((lt) => (
                    <option key={lt.value} value={lt.value}>{lt.label}</option>
                  ))}
                </select>
              )}

              {/* Note */}
              <input
                type="text"
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                placeholder="Note (optional)…"
                className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs
                           text-[#322E53] focus:outline-none w-36"
                maxLength={200}
              />

              {/* Toggles */}
              <div className="flex items-center gap-3 text-xs font-semibold text-amber-800">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkEmptyOnly}
                    onChange={(e) => setBulkEmptyOnly(e.target.checked)}
                    className="accent-amber-600"
                  />
                  Empty Only
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkApplyAll}
                    onChange={(e) => setBulkApplyAll(e.target.checked)}
                    className="accent-amber-600"
                  />
                  All Period Dates
                </label>
              </div>

              {!bulkEmptyOnly && (
                <div className="flex items-center gap-1 text-[10px] text-red-600 font-semibold">
                  <AlertTriangle className="w-3 h-3" />
                  Overwrites existing overrides
                </div>
              )}

              <div className="flex-1" />

              <button
                onClick={() => { setShowBulk(false); setSelectedEmpIds(new Set()) }}
                className="px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-semibold
                           text-amber-700 hover:bg-amber-100 transition-colors shrink-0"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkApply}
                disabled={bulking || employees.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600
                           hover:bg-amber-700 text-white text-xs font-bold transition-colors
                           disabled:opacity-50 shrink-0"
              >
                {bulking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Mark Selected
              </button>
            </div>
          )}

          {/* ── Dept Auto-fill Popover ─────────────────────────────────── */}
          {autofillDept && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
                 onClick={() => setAutofillDept(null)}>
              <div
                className="bg-white rounded-2xl border border-border shadow-2xl p-5 w-80 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <p className="text-sm font-extrabold text-[#322E53]">Auto-fill Empty Slots</p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    {autofillDept.name}
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
                    Mark all empty slots as
                  </label>
                  <select
                    value={autofillStatus}
                    onChange={(e) => setAutofillStatus(e.target.value as AttendanceStatusCode)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-[#F5F4F8]
                               text-sm font-medium text-[#322E53] focus:outline-none"
                  >
                    {BULK_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-muted-foreground font-medium">
                  Only empty (UNMARKED) slots will be filled. Existing overrides and calculated statuses are preserved.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAutofillDept(null)}
                    className="flex-1 px-3 py-2 rounded-xl border border-border text-xs font-semibold
                               text-[#322E53] hover:bg-[#F5F4F8] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAutofillConfirm}
                    disabled={autofillingDept}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                               bg-[#322E53] hover:bg-[#49426E] text-white text-xs font-bold
                               transition-colors disabled:opacity-50"
                  >
                    {autofillingDept
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Zap className="w-3 h-3" />}
                    Confirm Auto-fill
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Grid */}
          <div className="flex-1 overflow-auto bg-white">
            {loading && employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Loader2 className="w-8 h-8 text-[#EEC293] animate-spin mb-3" />
                <p className="text-sm font-semibold text-[#322E53]">Loading attendance grid…</p>
              </div>
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <Users className="w-10 h-10 text-[#EEC293] mb-3" />
                <p className="font-bold text-[#322E53] text-sm">No records found</p>
                <p className="text-xs text-muted-foreground font-medium mt-1">
                  {search ? "No employees match your search." : "No attendance data uploaded for this period."}
                </p>
                {search && (
                  <button
                    onClick={() => handleSearchChange("")}
                    className="mt-3 text-xs font-semibold text-[#322E53] underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <AttendanceGrid
                empsByDept={empsByDept}
                days={days}
                canOverride={canOverride}
                selectedEmpIds={selectedEmpIds}
                onToggleEmployee={toggleEmployee}
                onToggleAll={toggleSelectAll}
                allSelected={allSelected}
                someSelected={someSelected}
                onCellClick={handleCellClick}
                onAutofillDept={(dept) => { setAutofillDept(dept); setAutofillStatus("ABSENT") }}
                showDeptSeparators={!selectedDeptId}
              />
            )}
          </div>
        </div>
      </div>

      {/* Override Modal */}
      <OverrideModal
        target={overrideTarget}
        open={overrideOpen}
        onClose={() => { setOverrideOpen(false); setOverrideTarget(null) }}
        onSaved={handleOverrideSaved}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AttendanceGrid — pure table, extracted for clarity
// ─────────────────────────────────────────────────────────────────────────────

interface AttendanceGridProps {
  empsByDept:         Array<{ dept: DeptInfo | null; emps: EmployeeRow[] }>
  days:               DayInfo[]
  canOverride:        boolean
  selectedEmpIds:     Set<string>
  onToggleEmployee:   (id: string) => void
  onToggleAll:        () => void
  allSelected:        boolean
  someSelected:       boolean
  onCellClick:        (emp: EmployeeRow, rec: RecordRow) => void
  onAutofillDept:     (dept: { id: string; name: string }) => void
  showDeptSeparators: boolean
}

// Global row counter across groups
let _rowCounter = 0

function AttendanceGrid({
  empsByDept,
  days,
  canOverride,
  selectedEmpIds,
  onToggleEmployee,
  onToggleAll,
  allSelected,
  someSelected,
  onCellClick,
  onAutofillDept,
  showDeptSeparators,
}: AttendanceGridProps) {
  // Reset row counter
  _rowCounter = 0

  const colCount = 3 + days.length // checkbox + # + employee + days

  return (
    <table
      className="border-collapse text-xs"
      style={{ minWidth: "max-content", tableLayout: "fixed" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <thead>
        <tr className="bg-[#322E53] text-white">
          {/* Checkbox col — sticky col 1 */}
          <th
            className="sticky left-0 z-30 bg-[#322E53] border-r border-white/10
                       text-center font-extrabold text-[10px]"
            style={{ width: "36px", minWidth: "36px" }}
          >
            <button
              onClick={onToggleAll}
              className="flex items-center justify-center w-full h-full py-3"
              title={allSelected ? "Deselect all" : "Select all"}
            >
              {allSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-[#EEC293]" />
              ) : someSelected ? (
                <div className="w-3.5 h-3.5 rounded border-2 border-[#EEC293] bg-[#EEC293]/20 flex items-center justify-center">
                  <div className="w-1.5 h-0.5 bg-[#EEC293] rounded" />
                </div>
              ) : (
                <Square className="w-3.5 h-3.5 text-white/40" />
              )}
            </button>
          </th>
          {/* # — sticky col 2 */}
          <th
            className="sticky z-30 bg-[#322E53] border-r border-white/10
                       text-center font-extrabold text-[10px] uppercase tracking-wider py-3"
            style={{ left: "36px", width: "36px", minWidth: "36px" }}
          >
            #
          </th>
          {/* Employee — sticky col 3 */}
          <th
            className="sticky z-30 bg-[#322E53] border-r border-white/10
                       text-left font-extrabold text-[10px] uppercase tracking-wider px-3 py-3"
            style={{ left: "72px", width: "220px", minWidth: "220px" }}
          >
            Employee
          </th>
          {/* Date columns */}
          {days.map((day) => (
            <th
              key={day.dateStr}
              className={cn(
                "border-r border-white/10 text-center font-extrabold py-3",
                day.isSunday ? "bg-[#1e1b4b]/80" : day.isSaturday ? "bg-[#49426E]" : ""
              )}
              style={{ width: "46px", minWidth: "46px" }}
            >
              <div className="text-[11px] leading-none">{day.dayNum}</div>
              <div className="text-[9px] opacity-60 font-semibold mt-0.5">{day.dayAbbr}</div>
            </th>
          ))}
        </tr>
      </thead>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <tbody>
        {empsByDept.map(({ dept, emps }) => (
          <>
            {/* Department separator row */}
            {showDeptSeparators && dept && (
              <tr key={`sep-${dept.id}`} className="bg-[#F5F4F8] border-b border-border">
                <td colSpan={colCount}>
                  <div className="flex items-center gap-3 px-4 py-1.5">
                    <span className="text-[9px] font-bold text-muted-foreground bg-[#322E53]/10
                                     px-1.5 py-0.5 rounded">
                      {dept.code}
                    </span>
                    <span className="text-xs font-extrabold text-[#322E53]">{dept.name}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {emps.length} employee{emps.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex-1" />
                    {canOverride && (
                      <button
                        onClick={() => onAutofillDept({ id: dept.id, name: dept.name })}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#322E53]/10
                                   hover:bg-[#322E53]/20 text-[#322E53] text-[10px] font-bold
                                   transition-colors"
                      >
                        <Zap className="w-3 h-3" />
                        Auto-fill
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {/* Employee rows */}
            {emps.map((emp) => {
              const ei       = _rowCounter++
              const isEven   = ei % 2 === 0
              const rowBg    = isEven ? "bg-white" : "bg-[#F5F4F8]/40"
              const isChecked = selectedEmpIds.has(emp.id)

              return (
                <tr
                  key={emp.id}
                  className={cn(
                    "border-b border-border transition-colors",
                    isChecked ? "bg-amber-50/60" : rowBg
                  )}
                >
                  {/* Checkbox */}
                  <td
                    className={cn(
                      "sticky left-0 z-10 border-r border-border text-center py-2",
                      isChecked
                        ? "bg-amber-50"
                        : isEven ? "bg-white" : "bg-[#F5F4F8]/60"
                    )}
                    style={{ width: "36px" }}
                  >
                    <button
                      onClick={() => onToggleEmployee(emp.id)}
                      className="flex items-center justify-center w-full"
                    >
                      {isChecked
                        ? <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                        : <Square className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500" />
                      }
                    </button>
                  </td>

                  {/* # */}
                  <td
                    className={cn(
                      "sticky z-10 border-r border-border text-center text-[10px]",
                      "font-bold text-muted-foreground py-2",
                      isChecked
                        ? "bg-amber-50"
                        : isEven ? "bg-white" : "bg-[#F5F4F8]/60"
                    )}
                    style={{ left: "36px", width: "36px" }}
                  >
                    {ei + 1}
                  </td>

                  {/* Employee name + designation */}
                  <td
                    className={cn(
                      "sticky z-10 border-r border-border px-3 py-2 whitespace-nowrap",
                      isChecked
                        ? "bg-amber-50"
                        : isEven ? "bg-white" : "bg-[#F5F4F8]/60"
                    )}
                    style={{ left: "72px", width: "220px" }}
                  >
                    <div className="font-semibold text-[#322E53] text-xs leading-tight truncate max-w-[200px]">
                      {emp.name}
                    </div>
                    {emp.designation && (
                      <div className="text-[9px] text-muted-foreground font-medium mt-0.5 truncate max-w-[200px]">
                        {emp.designation}
                      </div>
                    )}
                  </td>

                  {/* Day cells */}
                  {days.map((day) => {
                    // Sunday → always OFF cell, not clickable
                    if (day.isSunday) {
                      return (
                        <td
                          key={day.dateStr}
                          className="border-r border-border text-center py-2 bg-slate-900/5"
                          style={{ width: "46px" }}
                        >
                          <span className="text-[9px] font-bold text-slate-400">OFF</span>
                        </td>
                      )
                    }

                    const rec = emp.recordMap.get(day.dateStr)

                    // No record for this date
                    if (!rec) {
                      return (
                        <td
                          key={day.dateStr}
                          className={cn(
                            "border-r border-border text-center py-2",
                            day.isSaturday ? "bg-slate-50" : ""
                          )}
                          style={{ width: "46px" }}
                        >
                          <span className="text-slate-200 text-[10px]">—</span>
                        </td>
                      )
                    }

                    const cell        = CELL[rec.effectiveStatus] ?? CELL.UNMARKED
                    const isOverridden = rec.isOverridden
                    const tooltip = [
                      cell.label,
                      rec.inTime && rec.outTime ? `${rec.inTime} – ${rec.outTime}` : null,
                      rec.workedMinutes ? fmtWorked(rec.workedMinutes) : null,
                      isOverridden ? "⬡ Overridden" : null,
                      rec.note ? `Note: ${rec.note}` : null,
                    ].filter(Boolean).join("\n")

                    return (
                      <td
                        key={day.dateStr}
                        className={cn(
                          "border-r border-border text-center py-1.5 group relative",
                          day.isSaturday ? "bg-slate-50/60" : "",
                          canOverride && "cursor-pointer hover:bg-[#F5F4F8]/80"
                        )}
                        style={{ width: "46px" }}
                        onClick={() => canOverride && onCellClick(emp, rec)}
                      >
                        {/* Status badge */}
                        <div className={cn(
                          "relative inline-flex items-center justify-center mx-auto",
                          "w-9 h-7 rounded-md font-extrabold text-[10px] transition-all",
                          cell.bg, cell.text,
                          canOverride && "group-hover:scale-110 group-hover:shadow-md"
                        )}>
                          {cell.abbr}
                          {/* Orange dot for overridden */}
                          {isOverridden && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full
                                             bg-orange-400 border border-white" />
                          )}
                        </div>

                        {/* Hover tooltip */}
                        <div
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50
                                     bg-[#1e1b4b] text-white text-[10px] font-medium px-2.5 py-2
                                     rounded-xl whitespace-pre opacity-0 group-hover:opacity-100
                                     pointer-events-none shadow-xl transition-opacity
                                     min-w-max max-w-[180px]"
                        >
                          {tooltip}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </>
        ))}
      </tbody>
    </table>
  )
}
