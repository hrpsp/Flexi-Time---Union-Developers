"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  Plus, Loader2, Trash2, CheckCircle2, Circle, AlertCircle,
  CalendarRange, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { usePermission } from "@/hooks/use-permission"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Period {
  id:        string
  label:     string
  startDate: string
  endDate:   string
  isActive:  boolean
  createdAt: string
  _count:    { records: number }
}

interface PeriodSectionProps {
  periods:   Period[]
  loading:   boolean
  onRefresh: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(val: string): string {
  try { return format(new Date(val), "dd MMM yyyy") } catch { return val }
}

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
// Create Period Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface CreateDialogProps {
  open:     boolean
  onClose:  () => void
  onCreated: () => void   // triggers parent refresh
}

function CreatePeriodDialog({ open, onClose, onCreated }: CreateDialogProps) {
  const [label,     setLabel]     = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate,   setEndDate]   = useState("")
  const [setActive, setSetActive] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [errors,    setErrors]    = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setLabel(""); setStartDate(""); setEndDate(""); setSetActive(false); setErrors({})
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!label.trim())  errs.label     = "Label is required."
    if (!startDate)     errs.startDate = "Start date is required."
    if (!endDate)       errs.endDate   = "End date is required."
    if (startDate && endDate && endDate < startDate)
      errs.endDate = "End date must be on or after start date."
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const res  = await fetch("/api/attendance/periods", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ label: label.trim(), startDate, endDate, isActive: setActive }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed to create period."); return }
      toast.success("Period created successfully.")
      onCreated()
      onClose()
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl shadow-[#322E53]/20 border border-border w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F5F4F8] flex items-center justify-center">
              <CalendarRange className="w-[18px] h-[18px] text-[#322E53]" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#322E53]">New Attendance Period</h2>
              <p className="text-xs text-muted-foreground font-medium">Define the date range for this period</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="w-8 h-8 rounded-lg hover:bg-[#F5F4F8] flex items-center justify-center
                       text-muted-foreground transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <FieldLabel required>Period Label</FieldLabel>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. January 2025"
              className={cn(inputCls, errors.label && "border-red-400")}
            />
            <FieldError message={errors.label} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Start Date</FieldLabel>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={cn(inputCls, errors.startDate && "border-red-400")}
              />
              <FieldError message={errors.startDate} />
            </div>
            <div>
              <FieldLabel required>End Date</FieldLabel>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={cn(inputCls, errors.endDate && "border-red-400")}
              />
              <FieldError message={errors.endDate} />
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer
                            hover:bg-[#F5F4F8] transition-colors">
            <input
              type="checkbox"
              checked={setActive}
              onChange={(e) => setSetActive(e.target.checked)}
              className="w-4 h-4 rounded accent-[#322E53]"
            />
            <div>
              <span className="text-sm font-semibold text-[#322E53]">Set as Active Period</span>
              <p className="text-xs text-muted-foreground font-medium">
                Makes this the current working period (deactivates others)
              </p>
            </div>
          </label>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 px-4 rounded-xl border border-border text-sm font-semibold
                         text-[#322E53] hover:bg-[#F5F4F8] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                         bg-[#322E53] hover:bg-[#49426E] text-white text-sm font-bold
                         transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Period
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main PeriodSection Component (controlled — data managed by parent)
// ─────────────────────────────────────────────────────────────────────────────

export function PeriodSection({ periods, loading, onRefresh }: PeriodSectionProps) {
  const canUpload = usePermission("attendance:upload")

  const [showCreate,   setShowCreate]   = useState(false)
  const [togglingId,   setTogglingId]   = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Period | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  async function handleToggle(period: Period) {
    const action = period.isActive ? "deactivate" : "activate"
    setTogglingId(period.id)
    try {
      const res  = await fetch(`/api/attendance/periods/${period.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed to update period."); return }
      toast.success(action === "activate" ? "Period set as active." : "Period deactivated.")
      onRefresh()
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res  = await fetch(`/api/attendance/periods/${deleteTarget.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed to delete period."); return }
      toast.success("Period deleted.")
      setDeleteTarget(null)
      onRefresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <CalendarRange className="w-[18px] h-[18px] text-[#322E53]" />
            <span className="font-extrabold text-[#322E53] text-sm">Attendance Periods</span>
            {!loading && (
              <span className="text-xs text-muted-foreground font-medium">
                ({periods.length})
              </span>
            )}
          </div>
          {canUpload && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#322E53] text-white
                         text-xs font-bold hover:bg-[#49426E] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Period
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading periods…
            </div>
          ) : periods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarRange className="w-8 h-8 text-[#EEC293] mb-3" />
              <p className="font-bold text-[#322E53] text-sm">No periods yet</p>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                Create your first attendance period to start uploading data.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-[#F5F4F8]/60">
                  <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">Label</th>
                  <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">Date Range</th>
                  <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">Status</th>
                  <th className="px-5 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">Records</th>
                  {canUpload && (
                    <th className="px-5 py-3 text-right text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => {
                  const isToggling = togglingId === period.id
                  return (
                    <tr
                      key={period.id}
                      className="border-b border-border last:border-0 hover:bg-[#F5F4F8]/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-[#322E53]">{period.label}</span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground font-medium text-xs whitespace-nowrap">
                        {fmtDate(period.startDate)} — {fmtDate(period.endDate)}
                      </td>
                      <td className="px-5 py-3.5">
                        {period.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                                           bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                                           bg-slate-100 text-slate-500 text-[11px] font-bold border border-slate-200">
                            <Circle className="w-3 h-3" />Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="font-semibold text-[#322E53] text-xs">
                          {period._count.records.toLocaleString()}
                        </span>
                      </td>
                      {canUpload && (
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggle(period)}
                              disabled={isToggling}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50",
                                period.isActive
                                  ? "border border-slate-300 text-slate-600 hover:bg-slate-50"
                                  : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              )}
                            >
                              {isToggling
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : period.isActive
                                  ? <Circle className="w-3 h-3" />
                                  : <CheckCircle2 className="w-3 h-3" />
                              }
                              {period.isActive ? "Deactivate" : "Set Active"}
                            </button>

                            <button
                              onClick={() => setDeleteTarget(period)}
                              disabled={isToggling || period._count.records > 0}
                              title={period._count.records > 0
                                ? `Cannot delete — has ${period._count.records} records`
                                : "Delete period"
                              }
                              className="w-8 h-8 rounded-lg border border-red-200 text-red-500
                                         hover:bg-red-50 flex items-center justify-center
                                         transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CreatePeriodDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={onRefresh}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Period"
        description={`Are you sure you want to delete "${deleteTarget?.label}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </>
  )
}
