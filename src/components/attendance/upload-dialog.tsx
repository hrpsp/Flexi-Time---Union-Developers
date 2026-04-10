"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  X, Upload, Loader2, CheckCircle2, AlertTriangle, AlertCircle,
  ChevronRight, FileSpreadsheet, Users, Eye, Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { calcStatus, fmtWorked, STATUS_META } from "@/lib/attendance-calc"
import type { AttendanceStatusCode } from "@/lib/attendance-calc"
import type { Period } from "./period-section"
import type { MatchResult } from "@/app/api/attendance/match-employees/route"

// ──────────────────────────────────────────────────────────────────────────────
// XLSX is loaded dynamically (client-only, large package)
// ──────────────────────────────────────────────────────────────────────────────
async function loadXlsx() {
  return import("xlsx")
}

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
export type DetectedFormat = "row-per-punch" | "columnar" | "crystal-report" | null

interface RawRow {
  code: string
  date: string   // YYYY-MM-DD
  inTime: string | null
  outTime: string | null
}

interface PreviewRow extends RawRow {
  employeeId: string
  employeeName: string
  workedMinutes: number
  status: AttendanceStatusCode
}

interface ParseResult {
  format: DetectedFormat
  rows: RawRow[]
  codes: string[]
  dateRangeLabel?: string
}

interface SyncResult {
  created: number
  updated: number
  total: number
}

// ──────────────────────────────────────────────────────────────────────────────
// XLSX Parsing helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Convert Excel serial number to YYYY-MM-DD string */
function excelDateToStr(serial: number): string {
  const utc_days = Math.floor(serial - 25569)
  const ms = utc_days * 86400 * 1000
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Convert a JS Date to YYYY-MM-DD string */
function dateToStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Format a time value (could be string "HH:MM", Date, or number) into "HH:MM" */
function parseTimeVal(val: unknown): string | null {
  if (!val && val !== 0) return null
  if (val instanceof Date) {
    const h = String(val.getHours()).padStart(2, "0")
    const m = String(val.getMinutes()).padStart(2, "0")
    return `${h}:${m}`
  }
  if (typeof val === "number") {
    const totalMins = Math.round(val * 1440)
    const h = Math.floor(totalMins / 60) % 24
    const m = totalMins % 60
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }
  if (typeof val === "string") {
    const trimmed = val.trim()
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      const parts = trimmed.split(":")
      return `${String(parts[0]).padStart(2, "0")}:${parts[1]}`
    }
    return null
  }
  return null
}

/** Normalise a date cell to YYYY-MM-DD */
function parseDateVal(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) return dateToStr(val)
  if (typeof val === "number") return excelDateToStr(val)
  if (typeof val === "string") {
    const s = val.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
    if (dmy) {
      const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
      const m = dmy[2].padStart(2, "0")
      const d = dmy[1].padStart(2, "0")
      return `${y}-${m}-${d}`
    }
  }
  return null
}

/** Detect format from the header row */
function detectFormat(headers: string[]): DetectedFormat {
  const lower = headers.map((h) => String(h).toLowerCase().trim())
  const hasDate = lower.some((h) => h.includes("date"))
  const hasInTime = lower.some(
    (h) => h === "in" || h === "intime" || h === "in time" ||
      h === "checkin" || h === "check in" || h === "check-in" || h === "in_time"
  )
  const hasOutTime = lower.some(
    (h) => h === "out" || h === "outtime" || h === "out time" ||
      h === "checkout" || h === "check out" || h === "check-out" || h === "out_time"
  )
  if (hasDate && (hasInTime || hasOutTime)) return "row-per-punch"
  const dateLikeCount = lower.filter(
    (h) => /^\d{1,2}$/.test(h) || /^\d{4}-\d{2}-\d{2}/.test(h) || /^\d{1,2}[\/\-]\w+/.test(h)
  ).length
  if (dateLikeCount >= 5) return "columnar"
  return "row-per-punch"
}

/** Find column index by possible header names (case-insensitive) */
function findCol(headers: string[], ...names: string[]): number {
  const lower = headers.map((h) => String(h).toLowerCase().trim())
  for (const name of names) {
    const idx = lower.indexOf(name.toLowerCase())
    if (idx !== -1) return idx
  }
  return -1
}

// ──────────────────────────────────────────────────────────────────────────────
// Crystal Report Parser
// Union Developers Monthly IN-OUT Report (Excel export from Crystal Reports)
//
// Layout (rows before data):
//   "Union Developers"  /  "Monthly IN-OUT Report"
//   "For Date: YYYY/MM/DD to YYYY/MM/DD"
//   "Division:"
//   "Department: <num>   <name>"
//   Day numbers row  (21 22 23 ... 08)
//   Day-of-week row  (Sat Sun Mon ...)
//   Employee data rows (pairs: inTime row / outTime row)
//
// First column of each employee's inTime row:
//   "<hcmId> / <name>\n<designation>"   OR   "<hcmId> / <name> / <designation>"
// We extract ONLY the numeric HCM ID and ignore name/designation.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Extract numeric HCM ID from Crystal Report first-column text.
 * Handles multiline cells like "200201 / Hamza Khan\nAssistant Manager Finance"
 */
function extractHcmId(cellText: string): string | null {
  if (!cellText) return null
  const text = String(cellText).replace(/[\r\n]+/g, " ").trim()
  const match = text.match(/^(\d{4,10})/)
  return match ? match[1] : null
}

/**
 * Detect Crystal Report "Monthly IN-OUT" format.
 * Heuristic: first 10 rows contain "in-out" (or "in out") AND "for date".
 */
function isCrystalReport(rawData: unknown[][]): boolean {
  const first10 = rawData.slice(0, 10)
  let hasTitle = false
  let hasForDate = false
  for (const row of first10) {
    const rowText = (row as unknown[]).map((c) => String(c ?? "").toLowerCase()).join(" ")
    if (rowText.includes("in-out") || rowText.includes("in out report")) hasTitle = true
    if (rowText.includes("for date")) hasForDate = true
  }
  return hasTitle && hasForDate
}

/**
 * Build the date→column mapping from the day-number header row.
 * Day numbers that are >= startDay belong to startMonth; those < startDay belong to startMonth+1.
 */
function parseCrystalReportDates(
  rawData: unknown[][],
  dayHeaderRowIdx: number,
  reportStartDate: Date,
): Array<{ colIdx: number; dateStr: string }> {
  const startDay = reportStartDate.getDate()
  const startMonth = reportStartDate.getMonth()
  const startYear = reportStartDate.getFullYear()

  const dayRow = rawData[dayHeaderRowIdx] as unknown[]
  const dateCols: Array<{ colIdx: number; dateStr: string }> = []

  for (let c = 1; c < dayRow.length; c++) {
    const raw = String(dayRow[c] ?? "").trim()
    const dayNum = parseInt(raw, 10)
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) continue

    let year = startYear
    let month = startMonth
    if (dayNum < startDay) {
      // Wraps into next month
      month = startMonth + 1
      if (month > 11) { month = 0; year = startYear + 1 }
    }

    dateCols.push({
      colIdx: c,
      dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`,
    })
  }

  return dateCols
}

/**
 * Parse the Crystal Report Excel export.
 * Returns flat RawRow[] with HCM IDs cross-referenced by column index.
 */
function parseCrystalReport(rawData: unknown[][]): {
  rows: RawRow[]
  codes: string[]
  dateRangeLabel: string
} {
  // ── 1. Locate "For Date:" row ─────────────────────────────────────────────
  let reportStartDate: Date | null = null
  let dateRangeLabel = ""
  let forDateRowIdx = -1

  for (let r = 0; r < Math.min(rawData.length, 15); r++) {
    for (const cell of rawData[r] as unknown[]) {
      const text = String(cell ?? "").trim()
      const m = text.match(/for date[:\s]+([\d\/\-]+)\s+to\s+([\d\/\-]+)/i)
      if (m) {
        reportStartDate = new Date(m[1].replace(/\//g, "-"))
        dateRangeLabel = `${m[1]} to ${m[2]}`
        forDateRowIdx = r
        break
      }
    }
    if (reportStartDate) break
  }

  if (!reportStartDate || isNaN(reportStartDate.getTime())) {
    throw new Error("Crystal Report: could not parse the 'For Date:' range.")
  }

  // ── 2. Locate day-number header row ───────────────────────────────────────
  let dayHeaderRowIdx = -1
  for (let r = forDateRowIdx + 1; r < Math.min(rawData.length, forDateRowIdx + 12); r++) {
    const row = rawData[r] as unknown[]
    const numericCount = row.slice(1).filter((c) => {
      const n = parseInt(String(c ?? "").trim(), 10)
      return !isNaN(n) && n >= 1 && n <= 31
    }).length
    if (numericCount >= 5) {
      dayHeaderRowIdx = r
      break
    }
  }

  if (dayHeaderRowIdx === -1) {
    throw new Error("Crystal Report: could not find the day-number header row.")
  }

  // ── 3. Build column→date map ──────────────────────────────────────────────
  const dateCols = parseCrystalReportDates(rawData, dayHeaderRowIdx, reportStartDate)
  if (dateCols.length === 0) throw new Error("Crystal Report: no date columns found.")

  // ── 4. Parse employee row pairs ───────────────────────────────────────────
  const dataStartRow = dayHeaderRowIdx + 2  // skip day-of-week row
  const rows: RawRow[] = []
  const seen = new Set<string>()

  let i = dataStartRow
  while (i < rawData.length) {
    const rowA = rawData[i] as unknown[]
    const hcmId = extractHcmId(String(rowA?.[0] ?? ""))
    if (!hcmId) { i++; continue }

    seen.add(hcmId)
    const rowB = (rawData[i + 1] as unknown[]) ?? []

    for (const { colIdx, dateStr } of dateCols) {
      const inTime = parseTimeVal(rowA[colIdx])
      const outTime = parseTimeVal(rowB[colIdx])
      if (inTime !== null || outTime !== null) {
        rows.push({ code: hcmId, date: dateStr, inTime, outTime })
      }
    }

    i += 2  // advance past both in+out rows
  }

  return { rows, codes: [...seen], dateRangeLabel }
}

/** Parse the Excel workbook — auto-detects Crystal Report or standard formats */
async function parseWorkbook(file: File): Promise<ParseResult> {
  const XLSX = await loadXlsx()
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rawData = (XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  }) as unknown) as unknown[][]

  if (rawData.length < 2) throw new Error("Excel file is empty or has no data rows.")

  // ── Crystal Report detection (checked first) ──────────────────────────────
  if (isCrystalReport(rawData)) {
    const { rows, codes, dateRangeLabel } = parseCrystalReport(rawData)
    if (rows.length === 0) throw new Error("Crystal Report detected but no attendance records found.")
    return { format: "crystal-report", rows, codes, dateRangeLabel }
  }

  // ── Standard formats ──────────────────────────────────────────────────────
  const headerRow = (rawData[0] as unknown[]).map((h) => String(h ?? ""))
  const format = detectFormat(headerRow)
  const rows: RawRow[] = []

  if (format === "row-per-punch") {
    const codeIdx = findCol(headerRow,
      "empcode", "emp code", "emp_code", "empno", "emp no",
      "employee code", "code", "id", "hcmid", "hcm id", "hcm_id"
    )
    const dateIdx = findCol(headerRow, "date", "attendancedate", "attendance date")
    const inIdx = findCol(headerRow,
      "in", "intime", "in time", "in_time", "checkin", "check in", "check-in"
    )
    const outIdx = findCol(headerRow,
      "out", "outtime", "out time", "out_time", "checkout", "check out", "check-out"
    )

    if (codeIdx === -1) throw new Error("Could not find an employee code / HCM ID column.")
    if (dateIdx === -1) throw new Error("Could not find a date column.")

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i] as unknown[]
      const code = String(row[codeIdx] ?? "").trim()
      if (!code) continue
      const dateStr = parseDateVal(row[dateIdx])
      if (!dateStr) continue
      const inTime = inIdx !== -1 ? parseTimeVal(row[inIdx]) : null
      const outTime = outIdx !== -1 ? parseTimeVal(row[outIdx]) : null
      rows.push({ code, date: dateStr, inTime, outTime })
    }
  } else {
    const codeIdx = findCol(headerRow,
      "empcode", "emp code", "emp_code", "empno", "emp no",
      "code", "id", "employee code", "hcmid", "hcm id", "hcm_id"
    )
    const dateCols: { idx: number; dateStr: string }[] = []
    for (let c = 0; c < headerRow.length; c++) {
      const d = parseDateVal(headerRow[c])
      if (d) dateCols.push({ idx: c, dateStr: d })
    }

    if (dateCols.length === 0) throw new Error("Could not identify date columns in the columnar format.")
    if (codeIdx === -1) throw new Error("Could not find an employee code / HCM ID column.")

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i] as unknown[]
      const code = String(row[codeIdx] ?? "").trim()
      if (!code) continue
      for (const { idx, dateStr } of dateCols) {
        const cell = row[idx]
        if (!cell) continue
        const cellStr = String(cell).trim()
        const parts = cellStr.split(/[\-\/]/).map((s) => s.trim())
        const inTime = parts[0] ? parseTimeVal(parts[0]) : null
        const outTime = parts[1] ? parseTimeVal(parts[1]) : null
        rows.push({ code, date: dateStr, inTime, outTime })
      }
    }
  }

  const codes = [...new Set(rows.map((r) => r.code))]
  return { format, rows, codes }
}

// ──────────────────────────────────────────────────────────────────────────────
// Step indicator
// ──────────────────────────────────────────────────────────────────────────────
const STEPS = ["Upload", "Match", "Preview", "Sync"] as const

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5 px-6 py-4 border-b border-border bg-[#F5F4F8]/50">
      {STEPS.map((label, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold transition-colors",
                done ? "bg-emerald-500 text-white" : active ? "bg-[#322E53] text-white" : "bg-slate-200 text-slate-500"
              )}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx}
              </div>
              <span className={cn(
                "text-xs font-semibold",
                active ? "text-[#322E53]" : done ? "text-emerald-600" : "text-slate-400"
              )}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 mx-2 shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main UploadDialog Component
// ──────────────────────────────────────────────────────────────────────────────
interface UploadDialogProps {
  open: boolean
  onClose: () => void
  periods: Period[]
  onSynced?: (periodId: string) => void
}

export function UploadDialog({ open, onClose, periods, onSynced }: UploadDialogProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [periodId, setPeriodId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [matchResults, setMatchResults] = useState<MatchResult[]>([])
  const [matching, setMatching] = useState(false)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep(1); setPeriodId(""); setFile(null); setParsing(false)
    setParseError(null); setParseResult(null); setMatchResults([])
    setMatching(false); setPreviewRows([]); setSyncing(false)
    setSyncResult(null); setIsDragging(false)
  }

  function handleClose() { reset(); onClose() }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const f = files[0]
    if (!f.name.match(/\.(xlsx|xls|xlsm)$/i)) {
      setParseError("Please upload an Excel file (.xlsx, .xls, .xlsm).")
      return
    }
    setFile(f); setParseError(null); setParseResult(null)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [])

  async function handleParse() {
    if (!periodId) { setParseError("Please select an attendance period."); return }
    if (!file) { setParseError("Please upload an Excel file."); return }
    setParsing(true); setParseError(null)
    try {
      const result = await parseWorkbook(file)
      if (result.rows.length === 0) {
        setParseError("No records found in the file. Please check the format and try again.")
        return
      }
      setParseResult(result)
      setMatching(true)
      const res = await fetch("/api/attendance/match-employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: result.codes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Matching failed.")
      setMatchResults(data.results)
      setStep(2)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse file.")
    } finally {
      setParsing(false); setMatching(false)
    }
  }

  function handleProceedToPreview() {
    if (!parseResult) return
    const matchMap = new Map(matchResults.map((m) => [m.rawCode, m]))
    const preview: PreviewRow[] = parseResult.rows
      .map((row) => {
        const match = matchMap.get(row.code)
        if (!match?.matched) return null
        const { workedMinutes, status } = calcStatus(row.inTime, row.outTime)
        return {
          ...row,
          employeeId: match.employeeId!,
          employeeName: match.name!,
          workedMinutes,
          status,
        } satisfies PreviewRow
      })
      .filter((r): r is PreviewRow => r !== null)
    setPreviewRows(preview)
    setStep(3)
  }

  async function handleSync() {
    if (!parseResult) return
    setSyncing(true)
    const matchMap = new Map(matchResults.map((m) => [m.rawCode, m]))
    const records = parseResult.rows
      .map((row) => {
        const match = matchMap.get(row.code)
        if (!match?.matched) return null
        return { employeeId: match.employeeId!, date: row.date, inTime: row.inTime, outTime: row.outTime }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    try {
      const res = await fetch("/api/attendance/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId, records }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Sync failed.")
      setSyncResult(data)
      setStep(4)
      onSynced?.(periodId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed.")
    } finally {
      setSyncing(false)
    }
  }

  if (!open) return null

  const selectedPeriod = periods.find((p) => p.id === periodId)
  const matchedCount = matchResults.filter((m) => m.matched).length
  const unmatchedCount = matchResults.length - matchedCount
  const matchedRows = previewRows.length
  const isCrystal = parseResult?.format === "crystal-report"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !parsing && !matching && !syncing && handleClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl shadow-[#322E53]/20 border border-border w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F5F4F8] flex items-center justify-center">
              <FileSpreadsheet className="w-4.5 h-4.5 text-[#322E53]" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#322E53]">Upload Attendance Data</h2>
              <p className="text-xs text-muted-foreground font-medium">Crystal Report Excel Import</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={parsing || matching || syncing}
            className="w-8 h-8 rounded-lg hover:bg-[#F5F4F8] flex items-center justify-center text-muted-foreground transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <StepIndicator current={step} />

        <div className="flex-1 overflow-y-auto">
          {step === 1 && (
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
                  Attendance Period <span className="text-red-400">*</span>
                </label>
                <select
                  value={periodId}
                  onChange={(e) => setPeriodId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-brand-bg text-sm font-medium text-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-colors appearance-none"
                >
                  <option value="">Select a period…</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}{p.isActive ? " (Active)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
                  Excel File <span className="text-red-400">*</span>
                </label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                    isDragging ? "border-[#322E53] bg-[#F5F4F8]"
                      : file ? "border-emerald-400 bg-emerald-50/50"
                      : "border-border hover:border-[#322E53]/40 hover:bg-[#F5F4F8]/50"
                  )}
                >
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm" className="hidden"
                    onChange={(e) => handleFiles(e.target.files)} />
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileSpreadsheet className="w-7 h-7 text-emerald-600 shrink-0" />
                      <div className="text-left">
                        <p className="font-bold text-[#322E53] text-sm">{file.name}</p>
                        <p className="text-xs text-muted-foreground font-medium">
                          {(file.size / 1024).toFixed(1)} KB — click to change
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                      <p className="font-semibold text-[#322E53] text-sm">Drop your Excel file here</p>
                      <p className="text-xs text-muted-foreground font-medium mt-1">
                        or click to browse — .xlsx, .xls, .xlsm supported
                      </p>
                    </>
                  )}
                </div>
              </div>
              {parseError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-medium">{parseError}</p>
                </div>
              )}
              <div className="p-3 rounded-xl bg-[#F5F4F8] border border-border text-xs text-muted-foreground font-medium leading-relaxed">
                <p className="font-bold text-[#322E53] mb-1">Supported formats</p>
                <p>
                  <b>Crystal Report (auto-detected):</b> Union Developers Monthly IN-OUT Report.
                  Only the HCM ID from the first column is used to match employees —
                  name and designation are ignored. Dates are derived from the “For Date:” header.
                </p>
                <p className="mt-0.5">
                  <b>Row-per-punch:</b> Columns — EmpCode / HcmId, Date, In Time, Out Time
                </p>
                <p className="mt-0.5">
                  <b>Columnar:</b> Each row is an employee; date columns contain “HH:MM-HH:MM” or just in-time
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-6 space-y-4">
              {isCrystal && parseResult?.dateRangeLabel && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-blue-800">Crystal Report detected</span>
                    <span className="text-xs text-blue-600 ml-1">— period: {parseResult.dateRangeLabel}</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-[#F5F4F8] border border-border text-center">
                  <p className="text-xl font-extrabold text-[#322E53]">{parseResult?.codes.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">Unique Codes</p>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <p className="text-xl font-extrabold text-emerald-700">{matchedCount}</p>
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">Matched</p>
                </div>
                <div className={cn(
                  "p-3.5 rounded-xl text-center",
                  unmatchedCount > 0 ? "bg-amber-50 border border-amber-200" : "bg-slate-50 border border-border"
                )}>
                  <p className={cn("text-xl font-extrabold", unmatchedCount > 0 ? "text-amber-700" : "text-slate-400")}>
                    {unmatchedCount}
                  </p>
                  <p className={cn("text-xs font-medium mt-0.5", unmatchedCount > 0 ? "text-amber-600" : "text-slate-400")}>
                    Unmatched
                  </p>
                </div>
              </div>
              {unmatchedCount > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 font-medium">
                    {unmatchedCount} code{unmatchedCount !== 1 ? "s" : ""} could not be matched. Records for unmatched codes will be skipped.
                  </p>
                </div>
              )}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-y-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#F5F4F8] z-10">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">HCM ID</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">Employee</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">Department</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchResults.map((r) => (
                        <tr key={r.rawCode} className="border-t border-border hover:bg-[#F5F4F8]/40">
                          <td className="px-4 py-2.5 font-mono text-xs text-[#322E53] font-semibold">{r.rawCode}</td>
                          <td className="px-4 py-2.5 text-xs text-[#322E53] font-medium">{r.name ?? "—"}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground font-medium">{r.department ?? "—"}</td>
                          <td className="px-4 py-2.5 text-center">
                            {r.matched ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                <CheckCircle2 className="w-2.5 h-2.5" />Matched
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                                <AlertTriangle className="w-2.5 h-2.5" />Not found
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {matchedCount === 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-medium">
                    No employees matched. Please check that the HCM ID in your Excel matches the records in the system.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-[#322E53]">{matchedRows.toLocaleString()} records will be synced</p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    Showing first {Math.min(20, matchedRows)} — statuses calculated using default shift rules
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F4F8] border border-border">
                  <Eye className="w-3.5 h-3.5 text-[#322E53]" />
                  <span className="text-xs font-bold text-[#322E53]">Preview</span>
                </div>
              </div>
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-auto max-h-72">
                  <table className="w-full text-sm whitespace-nowrap">
                    <thead className="sticky top-0 bg-[#F5F4F8] z-10">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">Employee</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">Date</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">In</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">Out</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">Hours</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 20).map((row, i) => {
                        const meta = STATUS_META[row.status]
                        return (
                          <tr key={i} className="border-t border-border hover:bg-[#F5F4F8]/40">
                            <td className="px-4 py-2 text-xs font-medium text-[#322E53]">
                              <span className="truncate block max-w-[150px]">{row.employeeName}</span>
                              <span className="text-[10px] text-muted-foreground">{row.code}</span>
                            </td>
                            <td className="px-4 py-2 text-xs text-muted-foreground font-medium">{row.date}</td>
                            <td className="px-4 py-2 text-center text-xs font-mono text-[#322E53]">{row.inTime ?? "—"}</td>
                            <td className="px-4 py-2 text-center text-xs font-mono text-[#322E53]">{row.outTime ?? "—"}</td>
                            <td className="px-4 py-2 text-center text-xs font-medium text-[#322E53]">{fmtWorked(row.workedMinutes)}</td>
                            <td className="px-4 py-2 text-center">
                              <span className={cn("inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold", meta.bg, meta.text)}>
                                {meta.abbr || row.status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {matchedRows > 20 && (
                <p className="text-xs text-muted-foreground font-medium text-center">
                  … and {(matchedRows - 20).toLocaleString()} more records
                </p>
              )}
            </div>
          )}

          {step === 4 && syncResult && (
            <div className="p-8 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#322E53] text-lg">Sync Complete!</h3>
                <p className="text-sm text-muted-foreground font-medium mt-1">
                  Attendance data has been synced to <b>{selectedPeriod?.label}</b>
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <p className="text-2xl font-extrabold text-emerald-700">{syncResult.created}</p>
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">Created</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-center">
                  <p className="text-2xl font-extrabold text-blue-700">{syncResult.updated}</p>
                  <p className="text-xs text-blue-600 font-medium mt-0.5">Updated</p>
                </div>
                <div className="p-3 rounded-xl bg-[#F5F4F8] border border-border text-center">
                  <p className="text-2xl font-extrabold text-[#322E53]">{syncResult.total}</p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">Total</p>
                </div>
              </div>
              <div className="flex gap-3 w-full max-w-sm">
                <button onClick={handleClose}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-border text-sm font-semibold text-[#322E53] hover:bg-[#F5F4F8] transition-colors">
                  Close
                </button>
                <button onClick={() => { handleClose(); router.push(`/attendance/${periodId}`) }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#322E53] hover:bg-[#49426E] text-white text-sm font-bold transition-colors">
                  <Eye className="w-3.5 h-3.5" />View Grid
                </button>
              </div>
            </div>
          )}
        </div>

        {step < 4 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-[#F5F4F8]/30 shrink-0">
            <button
              onClick={step === 1 ? handleClose : () => setStep((s) => s - 1)}
              disabled={parsing || matching || syncing}
              className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-[#322E53] hover:bg-white transition-colors disabled:opacity-50"
            >
              {step === 1 ? "Cancel" : "Back"}
            </button>
            {step === 1 && (
              <button onClick={handleParse} disabled={parsing || matching || !file || !periodId}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#322E53] hover:bg-[#49426E] text-white text-sm font-bold transition-colors disabled:opacity-50">
                {(parsing || matching) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                {parsing ? "Parsing…" : matching ? "Matching…" : "Parse & Match"}
              </button>
            )}
            {step === 2 && (
              <button onClick={handleProceedToPreview} disabled={matchedCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#322E53] hover:bg-[#49426E] text-white text-sm font-bold transition-colors disabled:opacity-50">
                <Eye className="w-3.5 h-3.5" />Preview Records
              </button>
            )}
            {step === 3 && (
              <button onClick={handleSync} disabled={syncing || matchedRows === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#322E53] hover:bg-[#49426E] text-white text-sm font-bold transition-colors disabled:opacity-50">
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {syncing ? "Syncing…" : `Sync ${matchedRows.toLocaleString()} Records`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
