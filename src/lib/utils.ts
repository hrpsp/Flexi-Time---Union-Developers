import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format minutes → "Xh YYm" */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${String(m).padStart(2, "0")}m`
}

/** Parse "HH:MM" → minutes from midnight */
export function timeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null
  const [h, m] = time.split(":").map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

/** First letter of each word, capitalised */
export function titleCase(str: string): string {
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

/** Returns true when a YYYY-MM-DD date string falls on Sunday */
export function isSunday(dateStr: string): boolean {
  return new Date(dateStr + "T00:00:00").getDay() === 0
}

/** Initials from full name (max 2 chars) */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()
}
