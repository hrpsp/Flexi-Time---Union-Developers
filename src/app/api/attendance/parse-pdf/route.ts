import { withPermission, json } from "@/lib/with-permission"

export const runtime = "nodejs"
export const maxDuration = 60

interface RawRow {
  code: string
  date: string
  inTime: string | null
  outTime: string | null
}

interface ParseResult {
  format: "crystal-report"
  rows: RawRow[]
  codes: string[]
  dateRangeLabel: string
}

export async function POST(req: Request) {
  const guard = await withPermission("attendance:upload")
  if (guard) return guard

  const url = new URL(req.url)
  const debug = url.searchParams.get("debug") === "1"

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return json({ error: "Invalid multipart request." }, 400)
  }

  const file = formData.get("file") as File | null
  if (!file) return json({ error: "No file provided." }, 400)
  if (!file.name.toLowerCase().endsWith(".pdf"))
    return json({ error: "Only PDF files are accepted by this endpoint." }, 400)
  if (file.size > 25 * 1024 * 1024)
    return json({ error: "File too large. Maximum 25 MB." }, 400)

  try {
    const buffer = Buffer.from(await file.arrayBuffer())

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = ((await import("pdf-parse" as any)).default) as (
      buf: Buffer,
      options?: Record<string, unknown>
    ) => Promise<{ text: string; numpages: number }>

    const data = await pdfParse(buffer)
    const fullText = data.text

    if (!fullText.trim()) {
      throw new Error("PDF appears to be empty or image-only (scanned). Text extraction requires a digital PDF.")
    }

    // Debug mode: return the raw extracted text so we can inspect it
    if (debug) {
      return json({ debug: true, numpages: data.numpages, text: fullText.slice(0, 8000) })
    }

    const result = await parseCrystalReportPdf(fullText)
    return json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse PDF."
    return json({ error: message }, 422)
  }
}

// ── Crystal Report text parser ───────────────────────────────────────────────
//
// pdf-parse extracts text in reading order. For Crystal Reports, this means:
// The header lines come first, then for each department:
//   - A row of day numbers (like "21 22 23 24 25 26 27 28 29 30 31 01 02...")
//   - A row of day abbreviations (Sat Sun Mon Tue...)
//   - Employee pairs: HCM ID / Name row with in-times, followed by out-times row
//
// Key: pdf-parse preserves spacing, so day numbers appear as space-separated
// single or two-digit numbers. The employee HCM ID is always 5-6 digits at
// the start of the line.

async function parseCrystalReportPdf(fullText: string): Promise<ParseResult> {
  const lines = fullText
    .split(/\r?\n/)
    .map((l) => l.trimEnd())

  // ── 1. Find "For Date:" ────────────────────────────────────────────────
  let reportStartDate: Date | null = null
  let dateRangeLabel = ""
  let forDateLineIdx = -1

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/for\s+date[:\s]+(\d[\d/]+)\s+to\s+(\d[\d/]+)/i)
    if (m) {
      reportStartDate = new Date(m[1].replace(/\//g, "-"))
      dateRangeLabel = m[1] + " to " + m[2]
      forDateLineIdx = i
      break
    }
  }

  if (!reportStartDate || isNaN(reportStartDate.getTime())) {
    throw new Error("Crystal Report: could not parse the 'For Date:' range.")
  }

  const startDay = reportStartDate.getDate()
  const startMonth = reportStartDate.getMonth()
  const startYear = reportStartDate.getFullYear()

  // ── 2. Find day-number header row ──────────────────────────────────────
  // A line that when split by whitespace gives ≥5 tokens all being 1-2 digit
  // integers between 1 and 31. We search generously (up to 25 lines after "For Date:")
  let dayHeaderLineIdx = -1
  for (let i = forDateLineIdx + 1; i < Math.min(lines.length, forDateLineIdx + 25); i++) {
    if (isDayNumberRow(lines[i])) {
      dayHeaderLineIdx = i
      break
    }
  }

  if (dayHeaderLineIdx === -1) {
    // Try a fallback: look for a line where ALL tokens are 1-31
    for (let i = forDateLineIdx + 1; i < Math.min(lines.length, forDateLineIdx + 30); i++) {
      if (isDayNumberRowLoose(lines[i])) {
        dayHeaderLineIdx = i
        break
      }
    }
  }

  if (dayHeaderLineIdx === -1) {
    // Return debug info in the error
    const snippet = lines.slice(forDateLineIdx, forDateLineIdx + 20).join("\n")
    throw new Error(
      "Crystal Report: could not find the day-number header row. " +
        "Lines after For Date: " + JSON.stringify(snippet)
    )
  }

  // ── 3. Build column position → date map ───────────────────────────────
  const dayHeaderLine = lines[dayHeaderLineIdx]
  const dayPositions = buildDayPositions(dayHeaderLine, startDay, startMonth, startYear)

  if (dayPositions.length === 0) {
    throw new Error("Crystal Report: no date columns found in header row.")
  }

  // ── 4. Parse employee pairs ────────────────────────────────────────────
  const dataStartIdx = dayHeaderLineIdx + 2 // skip day-of-week row

  const rawRows: RawRow[] = []
  const seenHcmIds = new Set<string>()

  // Track current day positions (rebuilt per department)
  let currentDayPositions = dayPositions

  let i = dataStartIdx
  while (i < lines.length) {
    const line = lines[i]
    if (!line) { i++; continue }

    // Detect a new department day-number header
    if (isDayNumberRow(line) || isDayNumberRowLoose(line)) {
      currentDayPositions = buildDayPositions(line, startDay, startMonth, startYear)
      i += 2 // skip this header + day-of-week row
      continue
    }

    const hcmId = extractHcmId(line)
    if (hcmId) {
      seenHcmIds.add(hcmId)
      const inTimes = extractTimesFromLine(line, currentDayPositions)
      const nextLine = i + 1 < lines.length ? lines[i + 1] : ""
      const outTimes = extractTimesFromLine(nextLine, currentDayPositions)

      const allDates = new Set([...inTimes.keys(), ...outTimes.keys()])
      for (const dateStr of allDates) {
        rawRows.push({
          code: hcmId,
          date: dateStr,
          inTime: inTimes.get(dateStr) ?? null,
          outTime: outTimes.get(dateStr) ?? null,
        })
      }
      i += 2
      continue
    }

    i++
  }

  if (rawRows.length === 0) {
    throw new Error(
      "No attendance records could be extracted from the PDF. " +
        "Please confirm this is a Union Developers Monthly IN-OUT Report (digital PDF, not scanned)."
    )
  }

  return { format: "crystal-report", rows: rawRows, codes: [...seenHcmIds], dateRangeLabel }
}

// ── Helper: check if a line is a day-number row ──────────────────────────────

/** Strict: ≥5 whitespace-separated tokens, ALL 1–31 integers */
function isDayNumberRow(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  const tokens = trimmed.split(/\s+/)
  if (tokens.length < 5) return false
  return tokens.every((t) => /^\d{1,2}$/.test(t) && parseInt(t, 10) >= 1 && parseInt(t, 10) <= 31)
}

/** Loose: ≥8 tokens that are 1–31 integers (allows other content) */
function isDayNumberRowLoose(line: string): boolean {
  const tokens = line.trim().split(/\s+/)
  const dayNums = tokens.filter((t) => /^\d{1,2}$/.test(t) && parseInt(t, 10) >= 1 && parseInt(t, 10) <= 31)
  return dayNums.length >= 8
}

// ── Helper: build day positions from a header line ───────────────────────────

function buildDayPositions(
  line: string,
  startDay: number,
  startMonth: number,
  startYear: number
): Array<{ pos: number; dateStr: string }> {
  const positions: Array<{ pos: number; dateStr: string }> = []
  const re = /\b(\d{1,2})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    const dayNum = parseInt(m[1], 10)
    if (dayNum < 1 || dayNum > 31) continue
    let year = startYear
    let month = startMonth
    if (dayNum < startDay) {
      month++
      if (month > 11) { month = 0; year++ }
    }
    const dateStr =
      year + "-" + String(month + 1).padStart(2, "0") + "-" + String(dayNum).padStart(2, "0")
    positions.push({ pos: m.index, dateStr })
  }
  return positions
}

// ── Helper: extract HCM ID ────────────────────────────────────────────────────

function extractHcmId(line: string): string | null {
  const trimmed = line.trimStart()
  // Match: 5-6 digit number followed by " / " or whitespace+letter (start of name)
  const m = trimmed.match(/^(\d{4,10})(?:\s*\/|\s+[A-Za-z])/)
  return m ? m[1] : null
}

// ── Helper: extract times from a line ────────────────────────────────────────

function extractTimesFromLine(
  line: string,
  dayPositions: Array<{ pos: number; dateStr: string }>
): Map<string, string> {
  const X_TOLERANCE = 8
  const result = new Map<string, string>()
  const re = /\b(\d{1,2}:\d{2})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    const charPos = m.index
    let nearest: (typeof dayPositions)[0] | null = null
    let minDist = Infinity
    for (const col of dayPositions) {
      const dist = Math.abs(charPos - col.pos)
      if (dist < minDist && dist <= X_TOLERANCE) {
        minDist = dist
        nearest = col
      }
    }
    if (nearest && !result.has(nearest.dateStr)) {
      result.set(nearest.dateStr, m[1])
    }
  }
  return result
}
