// ─────────────────────────────────────────────────────────────────────────────
// Shared attendance calculation utilities (used by both client and server)
// ─────────────────────────────────────────────────────────────────────────────

export type AttendanceStatusCode =
  | "PRESENT" | "SHORT_TIME" | "HALF_DAY" | "ABSENT"
  | "MISSING_IN" | "MISSING_OUT" | "LEAVE" | "UNMARKED" | "OFF"

export interface ShiftRules {
  presentMinutes: number   // default 465  (~7h 45m)
  shortTimeMin:   number   // default 391  (~6h 31m)
  halfDayMin:     number   // default 240  (~4h)
}

export const DEFAULT_SHIFT: ShiftRules = {
  presentMinutes: 465,
  shortTimeMin:   391,
  halfDayMin:     240,
}

/** Compute raw worked minutes from HH:MM strings (handles overnight). */
export function calcWorkedMinutes(inTime: string, outTime: string): number {
  const [ih, im] = inTime.split(":").map(Number)
  const [oh, om] = outTime.split(":").map(Number)
  let mins = (oh * 60 + om) - (ih * 60 + im)
  if (mins < 0) mins += 1440   // overnight shift
  return Math.max(0, mins)
}

/** Derive { workedMinutes, status } from a punch pair + shift rules. */
export function calcStatus(
  inTime:  string | null,
  outTime: string | null,
  rules:   ShiftRules = DEFAULT_SHIFT,
): { workedMinutes: number; status: AttendanceStatusCode } {
  if (!inTime && !outTime) return { workedMinutes: 0, status: "ABSENT"      }
  if (!inTime  && outTime)  return { workedMinutes: 0, status: "MISSING_IN"  }
  if ( inTime  && !outTime) return { workedMinutes: 0, status: "MISSING_OUT" }

  const workedMinutes = calcWorkedMinutes(inTime!, outTime!)
  let status: AttendanceStatusCode

  if      (workedMinutes >= rules.presentMinutes) status = "PRESENT"
  else if (workedMinutes >= rules.shortTimeMin)   status = "SHORT_TIME"
  else if (workedMinutes >= rules.halfDayMin)      status = "HALF_DAY"
  else                                             status = "ABSENT"

  return { workedMinutes, status }
}

/** Format worked minutes as "7h 30m" */
export function fmtWorked(minutes: number): string {
  if (!minutes) return "—"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m.toString().padStart(2, "0")}m`
}

/** Abbreviation + Tailwind classes per status (for grid cells). */
export const STATUS_META: Record<AttendanceStatusCode, { abbr: string; bg: string; text: string }> = {
  PRESENT:     { abbr: "P",  bg: "bg-emerald-100", text: "text-emerald-700" },
  SHORT_TIME:  { abbr: "ST", bg: "bg-blue-100",    text: "text-blue-700"    },
  HALF_DAY:    { abbr: "H",  bg: "bg-amber-100",   text: "text-amber-700"   },
  ABSENT:      { abbr: "A",  bg: "bg-red-100",     text: "text-red-700"     },
  MISSING_IN:  { abbr: "MI", bg: "bg-orange-100",  text: "text-orange-700"  },
  MISSING_OUT: { abbr: "MO", bg: "bg-orange-100",  text: "text-orange-700"  },
  LEAVE:       { abbr: "L",  bg: "bg-purple-100",  text: "text-purple-700"  },
  OFF:         { abbr: "—",  bg: "bg-slate-50",    text: "text-slate-400"   },
  UNMARKED:    { abbr: "",   bg: "bg-transparent", text: "text-transparent"  },
}
