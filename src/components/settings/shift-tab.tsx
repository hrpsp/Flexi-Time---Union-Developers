"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Star, Loader2, X, Clock, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Shift {
  id:             string
  name:           string
  startTime:      string
  endTime:        string
  graceMinutes:   number
  presentMinutes: number
  shortTimeMin:   number
  halfDayMin:     number
  isDefault:      boolean
}

interface ShiftForm {
  name:           string
  startTime:      string
  endTime:        string
  graceMinutes:   number
  presentMinutes: number
  shortTimeMin:   number
  halfDayMin:     number
  isDefault:      boolean
}

const EMPTY_FORM: ShiftForm = {
  name:           "",
  startTime:      "08:00",
  endTime:        "17:00",
  graceMinutes:   15,
  presentMinutes: 465,
  shortTimeMin:   391,
  halfDayMin:     240,
  isDefault:      false,
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function minsToHm(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${h}h ${min.toString().padStart(2, "0")}m`
}

// ─────────────────────────────────────────────────────────────────────────────
// Shift Card
// ─────────────────────────────────────────────────────────────────────────────

function ShiftCard({
  shift,
  onEdit,
  onDelete,
  onSetDefault,
  settingDefault,
}: {
  shift:          Shift
  onEdit:         (s: Shift) => void
  onDelete:       (s: Shift) => void
  onSetDefault:   (id: string) => void
  settingDefault: string | null
}) {
  return (
    <div className={cn(
      "bg-white rounded-2xl border p-5 transition-all",
      shift.isDefault
        ? "border-[#322E53] shadow-sm shadow-[#322E53]/10"
        : "border-border hover:border-[#322E53]/30"
    )}>
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-[#322E53]">{shift.name}</span>
            {shift.isDefault && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#322E53] text-white text-[10px] font-bold uppercase tracking-wider">
                <Star className="w-2.5 h-2.5" />
                Default
              </span>
            )}
          </div>
          {/* Time + Grace */}
          <div className="flex items-center gap-2 mt-1.5 text-sm text-slate-600 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{shift.startTime} → {shift.endTime}</span>
            <span className="text-slate-300">·</span>
            <span>Grace: {shift.graceMinutes} min</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!shift.isDefault && (
            <button
              onClick={() => onSetDefault(shift.id)}
              disabled={settingDefault === shift.id}
              title="Set as default"
              className="p-2 rounded-lg text-slate-400 hover:text-[#322E53] hover:bg-[#F5F4F8] transition-colors disabled:opacity-50"
            >
              {settingDefault === shift.id
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Star className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={() => onEdit(shift)}
            title="Edit shift"
            className="p-2 rounded-lg text-slate-400 hover:text-[#322E53] hover:bg-[#F5F4F8] transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(shift)}
            title="Delete shift"
            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Thresholds */}
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Present ≥</p>
          <p className="text-sm font-bold text-emerald-700">{shift.presentMinutes} min</p>
          <p className="text-[11px] text-slate-400 font-medium">{minsToHm(shift.presentMinutes)}</p>
        </div>
        <div className="text-center border-x border-border">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Short Time ≥</p>
          <p className="text-sm font-bold text-amber-600">{shift.shortTimeMin} min</p>
          <p className="text-[11px] text-slate-400 font-medium">{minsToHm(shift.shortTimeMin)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Half Day ≥</p>
          <p className="text-sm font-bold text-orange-600">{shift.halfDayMin} min</p>
          <p className="text-[11px] text-slate-400 font-medium">{minsToHm(shift.halfDayMin)}</p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shift Modal
// ─────────────────────────────────────────────────────────────────────────────

function ShiftModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open:    boolean
  editing: Shift | null
  onClose: () => void
  onSaved: (shift: Shift) => void
}) {
  const [form,   setForm]   = useState<ShiftForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState("")

  useEffect(() => {
    if (open) {
      setError("")
      setForm(editing
        ? {
            name:           editing.name,
            startTime:      editing.startTime,
            endTime:        editing.endTime,
            graceMinutes:   editing.graceMinutes,
            presentMinutes: editing.presentMinutes,
            shortTimeMin:   editing.shortTimeMin,
            halfDayMin:     editing.halfDayMin,
            isDefault:      editing.isDefault,
          }
        : EMPTY_FORM
      )
    }
  }, [open, editing])

  if (!open) return null

  const set = (field: keyof ShiftForm, value: string | number | boolean) =>
    setForm((f) => ({ ...f, [field]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    // Client-side threshold validation
    if (form.halfDayMin >= form.shortTimeMin || form.shortTimeMin >= form.presentMinutes) {
      setError("Thresholds must satisfy: Half Day < Short Time < Present")
      return
    }

    setSaving(true)
    try {
      const url    = editing ? `/api/settings/shifts/${editing.id}` : "/api/settings/shifts"
      const method = editing ? "PATCH" : "POST"
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to save shift.")
        return
      }
      toast.success(editing ? "Shift updated." : "Shift created.")
      onSaved(data.shift)
      onClose()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const fieldCls = "w-full px-3 py-2 text-sm bg-white border border-border rounded-xl text-[#322E53] font-medium outline-none focus:border-[#322E53] transition-colors"
  const labelCls = "block text-xs font-bold text-[#49426E] uppercase tracking-wider mb-1.5"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl shadow-[#322E53]/20 border border-border w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <h3 className="text-base font-bold text-[#322E53]">
            {editing ? "Edit Shift Profile" : "Add Shift Profile"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#322E53] hover:bg-[#F5F4F8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className={labelCls}>Shift Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Morning Shift"
              className={fieldCls}
              required
            />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start Time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => set("startTime", e.target.value)}
                className={fieldCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>End Time</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => set("endTime", e.target.value)}
                className={fieldCls}
                required
              />
            </div>
          </div>

          {/* Grace */}
          <div>
            <label className={labelCls}>Grace Period (minutes)</label>
            <input
              type="number"
              min={0}
              max={120}
              value={form.graceMinutes}
              onChange={(e) => set("graceMinutes", Number(e.target.value))}
              className={fieldCls}
            />
          </div>

          {/* Thresholds */}
          <div>
            <p className={cn(labelCls, "mb-3")}>Attendance Thresholds</p>
            <div className="grid grid-cols-3 gap-3">
              {/* Present */}
              <div>
                <label className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
                  Present ≥ (min)
                </label>
                <input
                  type="number" min={1} max={1440}
                  value={form.presentMinutes}
                  onChange={(e) => set("presentMinutes", Number(e.target.value))}
                  className={cn(fieldCls, "focus:border-emerald-500")}
                />
                <p className="text-[10px] text-slate-400 font-medium mt-1">{minsToHm(form.presentMinutes)}</p>
              </div>
              {/* Short Time */}
              <div>
                <label className="block text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">
                  Short Time ≥ (min)
                </label>
                <input
                  type="number" min={1} max={1440}
                  value={form.shortTimeMin}
                  onChange={(e) => set("shortTimeMin", Number(e.target.value))}
                  className={cn(fieldCls, "focus:border-amber-500")}
                />
                <p className="text-[10px] text-slate-400 font-medium mt-1">{minsToHm(form.shortTimeMin)}</p>
              </div>
              {/* Half Day */}
              <div>
                <label className="block text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-1">
                  Half Day ≥ (min)
                </label>
                <input
                  type="number" min={1} max={1440}
                  value={form.halfDayMin}
                  onChange={(e) => set("halfDayMin", Number(e.target.value))}
                  className={cn(fieldCls, "focus:border-orange-500")}
                />
                <p className="text-[10px] text-slate-400 font-medium mt-1">{minsToHm(form.halfDayMin)}</p>
              </div>
            </div>
            {/* Threshold hint */}
            <p className="text-[11px] text-slate-400 font-medium mt-2">
              Rule: Half Day &lt; Short Time &lt; Present. Below Half Day threshold = Absent.
            </p>
          </div>

          {/* Default toggle */}
          {!editing?.isDefault && (
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => set("isDefault", !form.isDefault)}
                className={cn(
                  "w-10 h-6 rounded-full border-2 transition-colors relative cursor-pointer shrink-0",
                  form.isDefault ? "bg-[#322E53] border-[#322E53]" : "bg-white border-slate-300"
                )}
              >
                <span className={cn(
                  "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                  form.isDefault && "translate-x-4"
                )} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#322E53]">Set as default shift</p>
                <p className="text-[11px] text-slate-400 font-medium">Used when no specific shift is assigned to an employee</p>
              </div>
            </label>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 px-4 rounded-xl border border-border text-sm font-semibold text-[#322E53] hover:bg-[#F5F4F8] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#322E53] text-white text-sm font-bold hover:bg-[#49426E] transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editing ? "Save Changes" : "Create Shift"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shift Tab
// ─────────────────────────────────────────────────────────────────────────────

export function ShiftTab() {
  const [shifts,         setShifts]         = useState<Shift[]>([])
  const [loading,        setLoading]        = useState(true)
  const [showModal,      setShowModal]      = useState(false)
  const [editing,        setEditing]        = useState<Shift | null>(null)
  const [deleteTarget,   setDeleteTarget]   = useState<Shift | null>(null)
  const [deleting,       setDeleting]       = useState(false)
  const [settingDefault, setSettingDefault] = useState<string | null>(null)

  const fetchShifts = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/settings/shifts")
      const data = await res.json()
      if (res.ok) setShifts(data.shifts)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchShifts() }, [fetchShifts])

  function openAdd() {
    setEditing(null)
    setShowModal(true)
  }

  function openEdit(shift: Shift) {
    setEditing(shift)
    setShowModal(true)
  }

  function handleSaved(saved: Shift) {
    setShifts((prev) => {
      // If saved shift is default, unset others
      const updated = saved.isDefault
        ? prev.map((s) => ({ ...s, isDefault: false }))
        : [...prev]
      const idx = updated.findIndex((s) => s.id === saved.id)
      if (idx >= 0) {
        updated[idx] = saved
        return updated
      }
      return [...updated, saved]
    })
  }

  async function handleSetDefault(id: string) {
    setSettingDefault(id)
    try {
      const res  = await fetch(`/api/settings/shifts/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "set-default" }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed."); return }
      setShifts((prev) => prev.map((s) => ({ ...s, isDefault: s.id === id })))
      toast.success("Default shift updated.")
    } finally {
      setSettingDefault(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res  = await fetch(`/api/settings/shifts/${deleteTarget.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed to delete."); return }
      setShifts((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      toast.success(`"${deleteTarget.name}" deleted.`)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[#322E53]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-[#322E53]">Shift Profiles</h3>
          <p className="text-sm text-muted-foreground font-medium mt-0.5">
            Changes affect future attendance calculations only. Existing records are not recalculated.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#322E53] text-white text-sm font-bold hover:bg-[#49426E] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Shift
        </button>
      </div>

      {/* Shift list */}
      {shifts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-border text-center">
          <Clock className="w-9 h-9 text-[#EEC293] mb-3" />
          <p className="font-bold text-[#322E53]">No shift profiles</p>
          <p className="text-sm text-muted-foreground font-medium mt-1">Create your first shift to get started.</p>
          <button
            onClick={openAdd}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#322E53] text-white text-sm font-bold hover:bg-[#49426E] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Shift
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {shifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onSetDefault={handleSetDefault}
              settingDefault={settingDefault}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <ShiftModal
        open={showModal}
        editing={editing}
        onClose={() => setShowModal(false)}
        onSaved={handleSaved}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        variant="danger"
        title={`Delete "${deleteTarget?.name}"?`}
        description="This shift profile will be permanently removed. Employees using this shift will fall back to the default."
        confirmLabel="Delete Shift"
      />
    </div>
  )
}
