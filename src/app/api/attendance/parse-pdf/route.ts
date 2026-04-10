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
    const result = await parseCrystalReportPdf(buffer)
    return json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse PDF."
    return json({ error: message }, 422)
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface TextItem {
  str: string
  /** Approximate X position bucket (column index based on tab stops) */
  x: number
  /** Line number within the page */
  y: number
}

// ── Core PDF parser using pdf-parse ─────────────────────────────────────────

async function parseCrystalReportPdf(buffer: Buffer): Promise<ParseResult> {
  // pdf-parse is a pure-Node.js PDF text extractor — no web worker needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse = (await import("pdf-parse" as any)).default as (
    buf: Buffer,
    options?: Record<string, unknown>
  ) => Promise<{ text: string; numpages: number }>

  let fullText = ""
  try {
    const data = await pdfParse(buffer)
    fullText = data.text
  } catch (e) {
    throw new Error(
      "Could not extract text from PDF. Please ensure this is a digital (not scanned) Crystal Report PDF. Detail: " +
        (e instanceof Error ? e.message : String(e))
    )
  }

  if (!fullText.trim()) {
    throw new Error(
      "PDF appears to be empty or image-only (scanned). Text extraction requires a digital PDF."
    )
  }

  // Split into lines, clean up
  const lines = fullText
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0)

  return parseLinesAsCrystalReport(lines)
}

// ── Crystal Report text parser ───────────────────────────────────────────────
//
// The Crystal Report IN-OUT layout (as plain text from pdf-parse):
//
//   Union Developers
//   Monthly IN-OUT Report
//   For Date: 2024/03/21 to 2024/04/20
//   Department: ...
//   [day numbers row]  e.g.  21  22  23  24  ...
//   [day names row]    e.g.  Thu Fri Sat Sun ...
//   [employee rows — pairs of in/out lines]:
//     200201 / Employee Name\nDesignation    08:30  09:00  ...
//     [out times or blank]                    17:30  18:00  ...
//
// pdf-parse extracts text with spaces preserved, so column positions
// are represented as multiple spaces between values.

function parseLinesAsCrystalReport(lines: string[]): ParseResult {
  // ── 1. Find "For Date:" ────────────────────────────────────────────────
  let reportStartDate: Date | null = null
  let dateRangeLabel = ""
  let forDateLineIdx = -1

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
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

  // ── 2. Find the day-number header row ─────────────────────────────────
  // This is a line that contains ≥ 5 integers in range 1–31 separated by spaces
  let dayHeaderLineIdx = -1
  for (let i = forDateLineIdx + 1; i < Math.min(lines.length, forDateLineIdx + 15); i++) {
    const nums = extractDayNumbers(lines[i])
    if (nums.length >= 5) {
      dayHeaderLineIdx = i
      break
    }
  }

  if (dayHeaderLineIdx === -1) {
    throw new Error("Crystal Report: could not find the day-number header row.")
  }

  // ── 3. Build day-column positional map ────────────────────────────────
  // We parse the positions of each day number in the header line
  const dayHeaderLine = lines[dayHeaderLineIdx]
  const startDay = reportStartDate.getDate()
  const startMonth = reportStartDate.getMonth()
  const startYear = reportStartDate.getFullYear()

  // Extract all [charOffset, dayNumber] pairs from the header line
  const dayPositions: Array<{ pos: number; dayNum: number; dateStr: string }> = []
  const dayNumRegex = /\b(\d{1,2})\b/g
  let match: RegExpExecArray | null
  while ((match = dayNumRegex.exec(dayHeaderLine)) !== null) {
    const dayNum = parseInt(match[1], 10)
    if (dayNum < 1 || dayNum > 31) continue
    let year = startYear
    let month = startMonth
    if (dayNum < startDay) {
      month++
      if (month > 11) { month = 0; year++ }
    }
    const dateStr = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(dayNum).padStart(2, "0")
    dayPositions.push({ pos: match.index, dayNum, dateStr })
  }

  if (dayPositions.length === 0) {
    throw new Error("Crystal Report: no date columns found in header row.")
  }

  // ── 4. Parse employee row pairs (starting after the day-of-week row) ──
  const dataStartIdx = dayHeaderLineIdx + 2 // skip the day-of-week row

  const rawRows: RawRow[] = []
  const seenHcmIds = new Set<string>()

  let i = dataStartIdx
  while (i < lines.length) {
    const line = lines[i]

    // Detect new day-header row (re-detect for multi-department PDFs)
    const nums = extractDayNumbers(line)
    if (nums.length >= 5 && i > dayHeaderLineIdx) {
      // Rebuild day positions for this new department section
      const newDayPositions: typeof dayPositions = []
      const re2 = /\b(\d{1,2})\b/g
      let m2: RegExpExecArray | null
      while ((m2 = re2.exec(line)) !== null) {
        const dn = parseInt(m2[1], 10)
        if (dn < 1 || dn > 31) continue
        let year2 = startYear
        let month2 = startMonth
        if (dn < startDay) {
          month2++
          if (month2 > 11) { month2 = 0; year2++ }
        }
        const ds = year2 + "-" + String(month2 + 1).padStart(2, "0") + "-" + String(dn).padStart(2, "0")
        newDayPositions.push({ pos: m2.index, dayNum: dn, dateStr: ds })
      }
      if (newDayPositions.length >= 5) {
        dayPositions.splice(0, dayPositions.length, ...newDayPositions)
        i += 2 // skip this header row and the day-of-week row
        continue
      }
    }

    // Try to extract HCM ID from the start of this line
    const hcmId = extractHcmId(line)
    if (hcmId) {
      seenHcmIds.add(hcmId)
      const inTimes = extractTimesFromLine(line, dayPositions)
      const nextLine = lines[i + 1] ?? ""
      const outTimes = extractTimesFromLine(nextLine, dayPositions)

      const allDates = new Set([...inTimes.keys(), ...outTimes.keys()])
      for (const dateStr of allDates) {
        rawRows.push({
          code: hcmId,
          date: dateStr,
          inTime: inTimes.get(dateStr) ?? null,
          outTime: outTimes.get(dateStr) ?? null,
        })
      }
      i += 2 // consume both in-row and out-row
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

  return {
    format: "crystal-report",
    rows: rawRows,
    codes: [...seenHcmIds],
    dateRangeLabel,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractDayNumbers(line: string): number[] {
  const matches = line.match(/\b\d{1,2}\b/g) ?? []
  return matches
    .map(Number)
    .filter((n) => n >= 1 && n <= 31)
}

/**
 * Extract HCM ID (4–10 digit number) from the start of the line.
 * Crystal Report format: "200201 / Employee Name" or just "200201"
 */
function extractHcmId(line: string): string | null {
  const trimmed = line.trimStart()
  const m = trimmed.match(/^(\d{4,10})(?:\s*\/|\s+[A-Z])/)
  return m ? m[1] : null
}

/**
 * Extract HH:MM time strings from a line, mapped to the nearest day column
 * by character position. Uses a generous X_TOLERANCE to handle spacing drift.
 */
function extractTimesFromLine(
  line: string,
  dayPositions: Array<{ pos: number; dayNum: number; dateStr: string }>
): Map<string, string> {
  const X_TOLERANCE = 6 // characters
  const result = new Map<string, string>()
  const timeRegex = /\b(\d{1,2}:\d{2})\b/g
  let m: RegExpExecArray | null
  while ((m = timeRegex.exec(line)) !== null) {
    const timeStr = m[1]
    const charPos = m.index
    // Find the nearest day column
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
      result.set(nearest.dateStr, timeStr)
    }
  }
  return result
}
