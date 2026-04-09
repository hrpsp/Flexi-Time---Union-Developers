"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  Search, SlidersHorizontal, ChevronLeft, ChevronRight,
  Eye, Pencil, UserX, UserCheck, Loader2, Users, Plus, Upload,
  Calendar, AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePermission } from "@/hooks/use-permission"
import { EmployeeStatusBadge } from "./employee-status-badge"
import { ImportSheet } from "./import-sheet"
import { SearchableDeptSelect } from "./searchable-dept-select"
import type { DeptOption } from "./searchable-dept-select"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Employee {
  id:          string
  hcmId:       string
  name:        string
  designation: string | null
  grade:       string | null
  division:    string | null
  project:     string | null
  status:      "ACTIVE" | "INACTIVE"
  dol:         string | null
  department:  { id: string; name: string; code: number } | null
}

interface Counts { active: number; inactive: number }
interface Meta   { total: number; page: number; limit: number; totalPages: number }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(val: string | null | undefined): string {
  if (!val) return ""
  try { return format(new Date(val), "dd MMM yyyy") } catch { return "" }
}

function today(): string {
  return format(new Date(), "yyyy-MM-dd")
}

// Shared input / label / error classes
const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-border bg-brand-bg text-sm font-medium " +
  "text-brand-purple placeholder-slate-400 focus:outline-none focus:ring-2 " +
  "focus:ring-brand-purple/20 focus:border-brand-purple transition-colors"

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}
function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-500 font-medium">
      <AlertCircle className="w-3 h-3 shrink-0" />{message}
    </p>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton / Empty state
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 bg-slate-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  )
}

function EmptyState({ status }: { status: "ACTIVE" | "INACTIVE" }) {
  const canCreate = usePermission("employees:create")
  return (
    <tr>
      <td colSpan={9}>
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-bg flex items-center justify-center">
            <Users className="w-7 h-7 text-brand-purple/40" />
          </div>
          <div>
            <p className="text-sm font-bold text-brand-purple">
              No {status === "ACTIVE" ? "active" : "inactive"} employees found
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status === "ACTIVE"
                ? "Try adjusting your filters or add a new employee."
                : "All employees are currently active."}
            </p>
          </div>
          {status === "ACTIVE" && canCreate && (
            <Link
              href="/employees/new"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-purple text-white text-xs font-bold hover:bg-brand-mid-purple transition-colors shadow-sm shadow-brand-purple/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Employee
            </Link>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Deactivate Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface DeactivateDialogProps {
  employee: Employee
  onClose:  () => void
  onDone:   () => void
}

function DeactivateDialog({ employee, onClose, onDone }: DeactivateDialogProps) {
  const [dol,     setDol]     = useState(today())
  const [reason,  setReason]  = useState("")
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState(false)

  const confirm = async () => {
    setTouched(true)
    if (!dol) return
    setLoading(true)
    try {
      const res = await fetch(`/api/employees/${employee.id}/deactivate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ dol, reason: reason.trim() || undefined }),
      })
      const body = await res.json()
      if (!res.ok) { toast.error(body.error ?? "Failed to deactivate."); return }
      toast.success(`${employee.name} has been deactivated.`)
      onDone()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-brand-purple">Deactivate Employee</h2>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Mark <strong className="text-brand-purple">{employee.name}</strong> as inactive.
              Historical attendance data will be preserved.
            </p>
          </div>
        </div>

        {/* Date of Leaving */}
        <div>
          <FieldLabel required>Date of Leaving</FieldLabel>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={dol}
              max={today()}
              onChange={(e) => setDol(e.target.value)}
              className={cn(inputCls, "pl-10", touched && !dol && "border-red-400")}
            />
          </div>
          {touched && !dol && <FieldError message="Date of leaving is required." />}
        </div>

        {/* Reason */}
        <div>
          <FieldLabel>Reason <span className="text-slate-400 normal-case tracking-normal font-normal text-[11px]">(optional)</span></FieldLabel>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Resignation, Contract ended, Retirement…"
            className={cn(inputCls, "resize-none")}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-brand-purple hover:bg-brand-bg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors shadow-sm shadow-red-500/20 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Deactivate
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reactivate Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface ReactivateDialogProps {
  employee:    Employee
  departments: DeptOption[]
  onClose:     () => void
  onDone:      () => void
}

function ReactivateDialog({ employee, departments, onClose, onDone }: ReactivateDialogProps) {
  const [rejoiningDate, setRejoiningDate] = useState(today())
  const [designation,   setDesignation]   = useState(employee.designation ?? "")
  const [departmentId,  setDepartmentId]  = useState(employee.department?.id ?? "")
  const [note,          setNote]          = useState("")
  const [loading,       setLoading]       = useState(false)
  const [touched,       setTouched]       = useState(false)

  const confirm = async () => {
    setTouched(true)
    if (!rejoiningDate) return
    setLoading(true)
    try {
      const res = await fetch(`/api/employees/${employee.id}/reactivate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          rejoiningDate,
          designation:  designation.trim()  || undefined,
          departmentId: departmentId        || undefined,
          note:         note.trim()         || undefined,
        }),
      })
      const body = await res.json()
      if (!res.ok) { toast.error(body.error ?? "Failed to reactivate."); return }
      toast.success(`${employee.name} has been reactivated.`)
      onDone()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-brand-purple">Reactivate Employee</h2>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Reinstate <strong className="text-brand-purple">{employee.name}</strong>.
              Optionally update their department or designation.
            </p>
          </div>
        </div>

        {/* Date of Rejoining */}
        <div>
          <FieldLabel required>Date of Rejoining</FieldLabel>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={rejoiningDate}
              onChange={(e) => setRejoiningDate(e.target.value)}
              className={cn(inputCls, "pl-10", touched && !rejoiningDate && "border-red-400")}
            />
          </div>
          {touched && !rejoiningDate && <FieldError message="Date of rejoining is required." />}
        </div>

        {/* New Designation (optional) */}
        <div>
          <FieldLabel>New Designation <span className="text-slate-400 normal-case tracking-normal font-normal text-[11px]">(optional)</span></FieldLabel>
          <input
            type="text"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder={employee.designation ? `Current: ${employee.designation}` : "e.g. Senior Executive"}
            className={inputCls}
          />
        </div>

        {/* New Department (optional) */}
        <div>
          <FieldLabel>New Department <span className="text-slate-400 normal-case tracking-normal font-normal text-[11px]">(optional)</span></FieldLabel>
          <SearchableDeptSelect
            options={departments}
            value={departmentId}
            onChange={setDepartmentId}
            placeholder={employee.department ? `Current: ${employee.department.name}` : "Select department…"}
          />
        </div>

        {/* Note (optional) */}
        <div>
          <FieldLabel>Note <span className="text-slate-400 normal-case tracking-normal font-normal text-[11px]">(optional)</span></FieldLabel>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Returned after sabbatical, Re-hired…"
            className={cn(inputCls, "resize-none")}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-brand-purple hover:bg-brand-bg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors shadow-sm shadow-emerald-600/20 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Reactivate
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function EmployeeTable() {
  // Permissions
  const canCreate     = usePermission("employees:create")
  const canEdit       = usePermission("employees:edit")
  const canActivate   = usePermission("employees:activate")
  const canDeactivate = usePermission("employees:deactivate")
  const canImport     = usePermission("employees:import")

  // State
  const [tab,          setTab]          = useState<"ACTIVE" | "INACTIVE">("ACTIVE")
  const [search,       setSearch]       = useState("")
  const [deptId,       setDeptId]       = useState("")
  const [division,     setDivision]     = useState("")
  const [showFilters,  setShowFilters]  = useState(false)
  const [page,         setPage]         = useState(1)
  const [employees,    setEmployees]    = useState<Employee[]>([])
  const [meta,         setMeta]         = useState<Meta | null>(null)
  const [counts,       setCounts]       = useState<Counts>({ active: 0, inactive: 0 })
  const [loading,      setLoading]      = useState(true)
  const [departments,  setDepartments]  = useState<DeptOption[]>([])
  const [deactivating, setDeactivating] = useState<Employee | null>(null)
  const [reactivating, setReactivating] = useState<Employee | null>(null)
  const [showImport,   setShowImport]   = useState(false)

  // Load departments once
  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((b) => setDepartments(b.departments ?? []))
      .catch(() => {})
  }, [])

  // Fetch employees
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: tab,
        page:   String(page),
        limit:  "20",
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(deptId         ? { departmentId: deptId }  : {}),
        ...(division       ? { division }               : {}),
      })
      const res  = await fetch(`/api/employees?${params}`)
      const body = await res.json()
      if (!res.ok) { toast.error("Failed to load employees."); return }
      setEmployees(body.employees ?? [])
      setMeta(body.meta    ?? null)
      setCounts(body.counts ?? { active: 0, inactive: 0 })
    } finally {
      setLoading(false)
    }
  }, [tab, search, deptId, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [tab, search, deptId, division])

  const onActionDone = () => {
    setDeactivating(null)
    setReactivating(null)
    load()
  }

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-extrabold text-brand-purple">Employees</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage employee records and statuses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canImport && (
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-white hover:bg-brand-bg text-brand-purple text-sm font-bold transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import Excel
            </button>
          )}
          {canCreate && (
            <Link
              href="/employees/new"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-mid-purple text-white text-sm font-bold transition-colors shadow-md shadow-brand-purple/25"
            >
              <Plus className="w-4 h-4" />
              Add Employee
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">

        {/* ── Toolbar ────────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-3 space-y-3">

          {/* Tabs with count badges */}
          <div className="flex items-center gap-1 bg-brand-bg rounded-xl p-1 w-fit">
            {(["ACTIVE", "INACTIVE"] as const).map((s) => {
              const count  = s === "ACTIVE" ? counts.active : counts.inactive
              const active = tab === s
              return (
                <button
                  key={s}
                  onClick={() => setTab(s)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors",
                    active ? "bg-white text-brand-purple shadow-sm" : "text-muted-foreground hover:text-brand-purple"
                  )}
                >
                  {s === "ACTIVE" ? "Active Employees" : "Inactive Employees"}
                  <span className={cn(
                    "min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-extrabold flex items-center justify-center transition-colors",
                    active
                      ? s === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                      : "bg-border/80 text-muted-foreground"
                  )}>
                    {loading ? "…" : count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search + Filter toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, HCM ID, CNIC…"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-border bg-brand-bg text-sm font-medium text-brand-purple placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-colors"
              />
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2.5 rounded-lg border text-sm font-semibold transition-colors",
                showFilters
                  ? "border-brand-purple text-brand-purple bg-brand-bg"
                  : "border-border text-slate-500 bg-brand-bg hover:text-brand-purple"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {(deptId || division) && (
                <span className="w-4 h-4 rounded-full bg-brand-purple text-white text-[9px] font-extrabold flex items-center justify-center">
                  {[deptId, division].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* Collapsible filter row */}
          {showFilters && (
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <div className="relative">
                <select
                  value={deptId}
                  onChange={(e) => setDeptId(e.target.value)}
                  className="pl-3.5 pr-8 py-2 rounded-lg border border-border bg-brand-bg text-sm font-medium text-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-colors appearance-none cursor-pointer min-w-[180px]"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <select
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  className="pl-3.5 pr-8 py-2 rounded-lg border border-border bg-brand-bg text-sm font-medium text-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-colors appearance-none cursor-pointer min-w-[160px]"
                >
                  <option value="">All Divisions</option>
                  <option value="SUPPORT_SERVICES">Support Services</option>
                  <option value="INFRASTRUCTURE">Infrastructure</option>
                  <option value="CONSTRUCTION">Construction</option>
                  <option value="COMMERCIAL">Commercial</option>
                </select>
              </div>
              {(deptId || division) && (
                <button
                  onClick={() => { setDeptId(""); setDivision("") }}
                  className="text-xs font-semibold text-muted-foreground hover:text-brand-purple transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border bg-brand-bg/50">
                {["HCM ID", "Name", "Department", "Designation", "Grade", "Division", "Project", "Status", "Actions"].map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-[#49426E] whitespace-nowrap",
                      h === "Actions" ? "text-right" : "text-left"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                : employees.length === 0
                ? <EmptyState status={tab} />
                : employees.map((emp) => {
                    const isInactive = emp.status === "INACTIVE"
                    return (
                      <tr
                        key={emp.id}
                        className={cn(
                          "border-b border-border last:border-0 transition-colors group",
                          isInactive ? "bg-slate-50/60 hover:bg-slate-50" : "hover:bg-brand-bg/40"
                        )}
                      >
                        {/* HCM ID */}
                        <td className="px-4 py-3.5">
                          <span className={cn(
                            "font-mono text-xs font-bold px-2 py-0.5 rounded-md",
                            isInactive ? "text-slate-400 bg-slate-100" : "text-brand-mid-purple bg-brand-bg"
                          )}>
                            {emp.hcmId}
                          </span>
                        </td>

                        {/* Name + DOL sub-label */}
                        <td className="px-4 py-3.5">
                          <p className={cn(
                            "font-bold",
                            isInactive ? "text-slate-500" : "text-brand-purple"
                          )}>
                            {emp.name}
                          </p>
                          {isInactive && emp.dol && (
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3 shrink-0" />
                              Left {fmtDate(emp.dol)}
                            </p>
                          )}
                        </td>

                        {/* Department */}
                        <td className="px-4 py-3.5">
                          {emp.department ? (
                            <span className={cn(
                              "flex items-center gap-1.5 font-medium",
                              isInactive ? "text-slate-400" : "text-slate-600"
                            )}>
                              <span className="text-[10px] font-bold text-muted-foreground w-5 shrink-0">
                                {emp.department.code}
                              </span>
                              <span className="truncate max-w-[160px]">{emp.department.name}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>

                        {/* Designation */}
                        <td className={cn(
                          "px-4 py-3.5 font-medium",
                          isInactive ? "text-slate-400" : "text-slate-600"
                        )}>
                          {emp.designation ?? <span className="text-muted-foreground text-xs">—</span>}
                        </td>

                        {/* Grade */}
                        <td className={cn(
                          "px-4 py-3.5 font-medium",
                          isInactive ? "text-slate-400" : "text-slate-600"
                        )}>
                          {emp.grade ?? <span className="text-muted-foreground text-xs">—</span>}
                        </td>

                        {/* Division */}
                        <td className="px-4 py-3.5">
                          {emp.division ? (
                            <span className={cn(
                              "text-[11px] font-bold px-2 py-0.5 rounded",
                              isInactive ? "text-slate-400 bg-slate-100" : "text-brand-mid-purple bg-brand-bg"
                            )}>
                              {emp.division.replace("_", " ")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>

                        {/* Project */}
                        <td className={cn(
                          "px-4 py-3.5 font-medium max-w-[120px] truncate",
                          isInactive ? "text-slate-400" : "text-slate-600"
                        )}>
                          {emp.project ?? <span className="text-muted-foreground text-xs">—</span>}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <EmployeeStatusBadge status={emp.status} />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/employees/${emp.id}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-purple hover:bg-brand-bg transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>

                            {canEdit && !isInactive && (
                              <Link
                                href={`/employees/${emp.id}/edit`}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-brand-purple hover:bg-brand-bg transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </Link>
                            )}

                            {!isInactive && canDeactivate && (
                              <button
                                onClick={() => setDeactivating(emp)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Deactivate"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            )}

                            {isInactive && canActivate && (
                              <button
                                onClick={() => setReactivating(emp)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title="Reactivate"
                              >
                                <UserCheck className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-brand-bg/30">
            <p className="text-xs text-muted-foreground font-medium">
              Showing {((meta.page - 1) * meta.limit) + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.page <= 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-brand-purple hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-transparent hover:border-border"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === meta.totalPages || Math.abs(p - meta.page) <= 1)
                .reduce<(number | "...")[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...")
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span key={`ell-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-xs font-bold transition-colors",
                        meta.page === p
                          ? "bg-brand-purple text-white shadow-sm shadow-brand-purple/20"
                          : "text-slate-600 hover:bg-white hover:text-brand-purple border border-transparent hover:border-border"
                      )}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={meta.page >= meta.totalPages}
                className="p-1.5 rounded-lg text-slate-400 hover:text-brand-purple hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-transparent hover:border-border"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {meta && meta.totalPages <= 1 && meta.total > 0 && (
          <div className="px-5 py-3 border-t border-border bg-brand-bg/30">
            <p className="text-xs text-muted-foreground font-medium">
              {meta.total} employee{meta.total !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {/* ── Deactivate Dialog ─────────────────────────────────────────────── */}
      {deactivating && (
        <DeactivateDialog
          employee={deactivating}
          onClose={() => setDeactivating(null)}
          onDone={onActionDone}
        />
      )}

      {/* ── Reactivate Dialog ─────────────────────────────────────────────── */}
      {reactivating && (
        <ReactivateDialog
          employee={reactivating}
          departments={departments}
          onClose={() => setReactivating(null)}
          onDone={onActionDone}
        />
      )}

      {/* ── Import Sheet ──────────────────────────────────────────────────── */}
      <ImportSheet
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => { setShowImport(false); load() }}
      />
    </>
  )
}
