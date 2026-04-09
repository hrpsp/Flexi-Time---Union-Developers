"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { X, Loader2, Clock, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtWorked } from "@/lib/attendance-calc"
import type { AttendanceStatusCode } from "@/lib/attendance-calc"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type LeaveType = "ANNUAL" | "SICK" | "CASUAL" | "EMERGENCY" | "UNPAID" | "WORK_FROM_HOME"

export interface OverrideTarget {
  record: {
    id:               string
    date:             string
    inTime:           string | null
    outTime:          string | null
    workedMinutes:    number | null
    calculatedStatus: string
    overriddenStatus: string | null
    leaveType:        string | null
    note:             string | null
    isOverridden:     boolean
  }
  employee: {
    id:          string
    name:        string
    hcmId:       string
    designation: string | null
  }
}

interface OverrideModalProps {
  target:   OverrideTarget | null
  open:     boolean
  onClose:  () => void
  onSaved:  (recordId: string, updated: {
    overriddenStatus: string | null
    leaveType:        string | null
    note:             string | null
    isOverridden:     boolean
    effectiveStatus:  string
  }) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Status picker config (7 overridable statuses + clear)
// ─────────────────────────────────────────────────────────────────────────────

const OVERRIDE_STATUSES: Array<{
  value: AttendanceStatusCode
  label: string
  abbr:  string
  bg:    string
  text:  string
}> = [
  { value: "PRESENT",     label: "Present",     abbr: "P",  bg: "bg-emerald-700", text: "text-white"       },
  { value: "SHORT_TIME",  label: "Short Time",  abbr: "ST", bg: "bg-amber-600",   text: "text-white"       },
  { value: "HALF_DAY",    label: "Half Day",    abbr: "H",  bg: "bg-orange-600",  text: "text-white"       },
  { value: "ABSENT",      label: "Absent",      abbr: "A",  bg: "bg-red-700",     text: "text-white"       },
  { value: "LEAVE",       label: "Leave",       abbr: "L",  bg: "bg-blue-700",    text: "text-white"       },
  { value: "MISSING_IN",  label: "Missing In",  abbr: "MI", bg: "bg-violet-700",  text: "text-white"       },
  { value: "MISSING_OUT", label: "Missing Out", abbr: "MO", bg: "bg-fuchsia-700", text: "text-white"       },
]

const LEAVE_TYPE_OPTIONS: Array<{ value: LeaveType; label: string }> = [
  { value: "ANNUAL",        label: "Annual Leave"       },
  { value: "SICK",          label: "Sick Leave"         },
  { value: "CASUAL",        label: "Casual Leave"       },
  { value: "EMERGENCY",     label: "Emergency Leave"    },
  { value: "UNPAID",        label: "Unpaid Leave"       },
  { value: "WORK_FROM_HOME",label: "Work From Home"     },
]

const CALC_STATUS_LABEL: Record<string, string> = {
  PRESENT:     "Present",
  SHORT_TIME:  "Short Time",
  HALF_DAY:    "Half Day",
  ABSENT:      "Absent",
  MISSING_IN:  "Missing In",
  MISSING_OUT: "Missing Out",
  LEAVE:       "Leave",
  UNMARKED:    "Unmarked",
  OFF:         "Off / Holiday",
}

// ─────────────────────────────────────────────────────────────────────────────
// OverrideModal
// ─────────────────────────────────────────────────────────────────────────────

export function OverrideModal({ target, open, onClose, onSaved }: OverrideModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatusCode | null>(null)
  const [leaveType,      setLeaveType]      = useState<LeaveType | null>(null)
  const [note,           setNote]           = useState("")
  const [saving,         setSaving]         = useState(false)

  // Sync state with target record
  useEffect(() => {
    if (target && open) {
      setSelectedStatus((target.record.overriddenStatus as AttendanceStatusCode) ?? null)
      setLeaveType((target.record.leaveType as LeaveType) ?? null)
      setNote(target.record.note ?? "")
    }
  }, [target, open])

  if (!open || !target) return null

  const { record, employee } = target
  const hasChanges = selectedStatus !== null || note !== (record.note ?? "")

  // Format date for display
  function fmtDisplayDate(dateStr: string) {
    try {
      return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      })
    } catch { return dateStr }
  }

  async function handleSave() {
    if (!selectedStatus && !note) return
    setSaving(true)
    try {
      const res  = await fetch(`/api/attendance/records/${record.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          overriddenStatus: selectedStatus ?? null,
          leaveType:        selectedStatus === "LEAVE" ? leaveType : null,
          note:             note || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed to save override."); return }

      onSaved(record.id, {
        overriddenStatus: data.record.overriddenStatus,
        leaveType:        data.record.leaveType,
        note:             data.record.note,
        isOverridden:     data.record.isOverridden,
        effectiveStatus:  data.record.effectiveStatus,
      })
      toast.success("Override saved.")
      onClose()
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleClearOverride() {
    setSaving(true)
    try {
      const res  = await fetch(`/api/attendance/records/${record.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ overriddenStatus: null, leaveType: null }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed to clear override."); return }

      onSaved(record.id, {
        overriddenStatus: null,
        leaveType:        null,
        note:             data.record.note,
        isOverridden:     false,
        effectiveStatus:  data.record.effectiveStatus,
      })
      toast.success("Override cleared — reverted to system status.")
      onClose()
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl shadow-[#322E53]/25 border border-border w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-extrabold text-[#322E53] leading-tight">
              Override Attendance
            </h2>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              {employee.name} · {fmtDisplayDate(record.date)}
            </p>
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

        <div className="p-5 space-y-4">
          {/* Biometric card */}
          <div className="rounded-xl bg-[#F5F4F8] border border-border p-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <Clock className="w-3.5 h-3.5 text-[#322E53]" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">
                Biometric Data
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">In Time</p>
                <p className="text-sm font-extrabold text-[#322E53] font-mono">
                  {record.inTime ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Out Time</p>
                <p className="text-sm font-extrabold text-[#322E53] font-mono">
                  {record.outTime ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Worked</p>
                <p className="text-sm font-extrabold text-[#322E53]">
                  {fmtWorked(record.workedMinutes ?? 0)}
                </p>
              </div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-border flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                System Status
              </span>
              <span className="text-xs font-bold text-[#322E53]">
                {CALC_STATUS_LABEL[record.calculatedStatus] ?? record.calculatedStatus}
              </span>
            </div>
          </div>

          {/* Status picker */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#49426E] mb-2">
              Override Status
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {OVERRIDE_STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSelectedStatus(selectedStatus === s.value ? null : s.value)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border-2 transition-all",
                    selectedStatus === s.value
                      ? `${s.bg} ${s.text} border-transparent shadow-md scale-[1.03]`
                      : "border-border hover:border-[#322E53]/30 hover:bg-[#F5F4F8]"
                  )}
                >
                  <span className={cn(
                    "text-[11px] font-extrabold leading-none",
                    selectedStatus === s.value ? s.text : "text-[#322E53]"
                  )}>
                    {s.abbr}
                  </span>
                  <span className={cn(
                    "text-[8px] font-semibold leading-tight text-center",
                    selectedStatus === s.value ? "text-white/80" : "text-muted-foreground"
                  )}>
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Leave type (only if LEAVE selected) */}
          {selectedStatus === "LEAVE" && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
                Leave Type
              </p>
              <select
                value={leaveType ?? ""}
                onChange={(e) => setLeaveType((e.target.value as LeaveType) || null)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-brand-bg text-sm
                           font-medium text-brand-purple focus:outline-none focus:ring-2
                           focus:ring-brand-purple/20 focus:border-brand-purple transition-colors"
              >
                <option value="">Select leave type…</option>
                {LEAVE_TYPE_OPTIONS.map((lt) => (
                  <option key={lt.value} value={lt.value}>{lt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Note */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
              Note <span className="normal-case font-normal text-muted-foreground">(optional)</span>
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for override…"
              rows={2}
              maxLength={500}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-brand-bg text-sm
                         font-medium text-brand-purple placeholder-slate-400 resize-none
                         focus:outline-none focus:ring-2 focus:ring-brand-purple/20
                         focus:border-brand-purple transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2.5 px-5 pb-5">
          {record.isOverridden && (
            <button
              onClick={handleClearOverride}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border
                         text-xs font-semibold text-muted-foreground hover:bg-[#F5F4F8]
                         hover:text-[#322E53] transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              Clear Override
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold
                       text-[#322E53] hover:bg-[#F5F4F8] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!selectedStatus)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#322E53]
                       hover:bg-[#49426E] text-white text-sm font-bold transition-colors
                       disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Override
          </button>
        </div>
      </div>
    </div>
  )
}
