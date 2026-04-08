/**
 * Shared attendance business logic.
 * Usable in both server (Route Handlers, Server Actions) and client components.
 * No Prisma imports — keep this module edge/browser safe.
 */

import { AttendanceStatus } from "@prisma/client"
import { timeToMinutes, formatMinutes } from "./utils"

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — single source of truth for all shift rules
// ─────────────────────────────────────────────────────────────────────────────
export const ATTENDANCE_CONFIG = {
  SHIFT_START:     "10:00",
  SHIFT_END:       "18:00",
  GRACE_MINUTES:   15,
  PRESENT_MIN:     465,  // 7h 45m
  SHORT_TIME_MIN:  391,  // 6h 31m
  HALF_DAY_MIN:    240,  // 4h 00m
} as const

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CONFIG — colours and labels (matches index.html exactly)
// ─────────────────────────────────────────────────────────────────────────────
export type StatusKey = keyof typeof STATUS_CONFIG

export const STATUS_CONFIG = {
  PRESENT:      { code: "P",  label: "Present",      bg: "#052e16", text: "#4ade80", border: "#166534" },
  SHORT_TIME:   { code: "ST", label: "Short Time",   bg: "#1c1208", text: "#fbbf24", border: "#854d0e" },
  HALF_DAY:     { code: "HD", label: "Half Day",     bg: "#1c0a00", text: "#fb923c", border: "#9a3412" },
  ABSENT:       { code: "A",  label: "Absent",       bg: "#1c0000", text: "#f87171", border: "#991b1b" },
  LEAVE:        { code: "L",  label: "Leave",        bg: "#020c1f", text: "#60a5fa", border: "#1e40af" },
  MISSING_IN:   { code: "MI", label: "Missing In",   bg: "#0d0520", text: "#c084fc", border: "#6b21a8" },
  MISSING_OUT:  { code: "MO", label: "Missing Out",  bg: "#160320", text: "#e879f9", border: "#86198f" },
  UNMARKED:     { code: "?",  label: "Unmarked",     bg: "#111827", text: "#6b7280", border: "#374151" },
  OFF:          { code: "—",  label: "Day Off",      bg: "#0c111b", text: "#1e293b", border: "#1e293b" },
} as const satisfies Record<string, { code: string; label: string; bg: string; text: string; border: string }>

export const LEAVE_TYPES = [
  { value: "ANNUAL",         label: "Annual Leave"       },
  { value: "SICK",           label: "Sick Leave"         },
  { value: "CASUAL",         label: "Casual Leave"       },
  { value: "EMERGENCY",      label: "Emergency Leave"    },
  { value: "UNPAID",         label: "Unpaid Leave"       },
  { value: "WORK_FROM_HOME", label: "Work From Home"     },
] as const

// Statuses that can be set via override modal (excludes OFF)
export const OVERRIDE_STATUSES: AttendanceStatus[] = [
  "PRESENT", "SHORT_TIME", "HALF_DAY", "ABSENT",
  "LEAVE", "MISSING_IN", "MISSING_OUT",
]

// ─────────────────────────────────────────────────────────────────────────────
// CORE STATUS CALCULATION
// Mirrors the calcStatus() function in index.html
// ─────────────────────────────────────────────────────────────────────────────
export interface CalcResult {
  status:        AttendanceStatus
  workedMinutes: number | null
  workedFormatted: string | null
}

export function calcStatus(
  inTime:  string | null | undefined,
  outTime: string | null | undefined,
  isSunday: boolean,
): CalcResult {
  if (isSunday) {
    return { status: "OFF", workedMinutes: null, workedFormatted: null }
  }

  if (!inTime && !outTime) {
    return { status: "UNMARKED", workedMinutes: null, workedFormatted: null }
  }

  if (!inTime) {
    return { status: "MISSING_IN", workedMinutes: null, workedFormatted: null }
  }

  if (!outTime) {
    return { status: "MISSING_OUT", workedMinutes: null, workedFormatted: null }
  }

  let worked = (timeToMinutes(outTime) ?? 0) - (timeToMinutes(inTime) ?? 0)
  // Handle midnight crossover
  if (worked < 0) worked += 1440

  const formatted = formatMinutes(worked)

  if (worked >= ATTENDANCE_CONFIG.PRESENT_MIN)    return { status: "PRESENT",    workedMinutes: worked, workedFormatted: formatted }
  if (worked >= ATTENDANCE_CONFIG.SHORT_TIME_MIN) return { status: "SHORT_TIME", workedMinutes: worked, workedFormatted: formatted }
  if (worked >= ATTENDANCE_CONFIG.HALF_DAY_MIN)   return { status: "HALF_DAY",   workedMinutes: worked, workedFormatted: formatted }

  return { status: "ABSENT", workedMinutes: worked, workedFormatted: formatted }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the effective display status (override takes precedence) */
export function effectiveStatus(
  calculatedStatus: AttendanceStatus,
  overriddenStatus: AttendanceStatus | null | undefined,
): AttendanceStatus {
  return overriddenStatus ?? calculatedStatus
}

/** Get colour config for a status */
export function statusConfig(status: AttendanceStatus) {
  return STATUS_CONFIG[status as StatusKey] ?? STATUS_CONFIG.UNMARKED
}

/** Summary count type */
export type StatusSummary = Record<AttendanceStatus, number>

export function emptySummary(): StatusSummary {
  return {
    PRESENT: 0, SHORT_TIME: 0, HALF_DAY: 0, ABSENT: 0,
    LEAVE: 0, MISSING_IN: 0, MISSING_OUT: 0, UNMARKED: 0, OFF: 0,
  }
}
