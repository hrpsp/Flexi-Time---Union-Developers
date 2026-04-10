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
      throw new Error("PDF appears to be empty or image-only (scanned).")
    }

    const lines = fullText.split(/\r?\n/).map(l => l.trimEnd())

    if (debug) {
      return json({
        debug: true,
        numpages: data.numpages,
        lines: lines.slice(0, 80),
        text: fullText.slice(0, 8000),
      })
    }

    const result = parseCrystalReport(lines)
    return json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse PDF."
    return json({ error: message }, 422)
  }
}

// ── Crystal Report Parser ─────────────────────────────────────────────────────
//
// Strategy: Find the date range and day-number header.
// Then map employee time values by character position to day columns.
// Falls back to sequence-based mapping if column positions aren't reliable.

function parseCrystalReport(lines: string[]): ParseResult {
  // ── 1. Find "For Date:" ────────────────────────────────────────────────
  let reportStart: Date | null = null
  let reportEnd: Date | null = null
  let dateRangeLabel = ""
  let forDateIdx = -1

  for (let i = 0; i < lines.length; i++) {
    // Join multi-word "For Date:" that might be split by whitespace
    const normalized = lines[i].replace(/\s+/g, " ")
    const m = normalized.match(/for date[: ]+([\d/]+) to ([\d/]+)/i)
    if (m) {
      reportStart = new Date(m[1].replace(/\//g, "-"))
      reportEnd = new Date(m[2].replace(/\//g, "-"))
      dateRangeLabel = m[1] + " to " + m[2]
      forDateIdx = i
      break
    }
  }

  if (!reportStart || isNaN(reportStart.getTime())) {
    const preview = lines.slice(0, 15).join(" | ").slice(0, 400)
    throw new Error("Crystal Report: could not parse 'For Date:'. Lines: " + preview)
  }

  const startDay = reportStart.getDate()
  const startMonth = reportStart.getMonth()
  const startYear = reportStart.getFullYear()
  const endDay = reportEnd!.getDate()
  const endMonth = reportEnd!.getMonth()
  const endYear = reportEnd!.getFullYear()

  // Build the ordered list of all dates in the report period
  const allDates: string[] = []
  const cur = new Date(reportStart)
  const end = new Date(reportEnd!)
  end.setDate(end.getDate() + 1) // inclusive
  while (cur < end) {
    allDates.push(
      cur.getFullYear() + "-" +
      String(cur.getMonth() + 1).padStart(2, "0") + "-" +
      String(cur.getDate()).padStart(2, "0")
    )
    cur.setDate(cur.getDate() + 1)
  }

  // ── 2. Find day-number header row ──────────────────────────────────────
  let dayHeaderIdx = -1
  let dayPositions: Array<{ pos: number; dateStr: string }> = []

  for (let i = forDateIdx + 1; i < Math.min(lines.length, forDateIdx + 40); i++) {
    const pos = tryBuildDayPositions(lines[i], startDay, startMonth, startYear)
    if (pos && pos.length >= 5) {
      dayHeaderIdx = i
      dayPositions = pos
      break
    }
  }

  // ── 3. Parse employee pairs ────────────────────────────────────────────
  // If day header not found, skip to finding employees directly (sequence mode)
  const dataStart = dayHeaderIdx >= 0 ? dayHeaderIdx + 2 : forDateIdx + 3
  const rawRows: RawRow[] = []
  const seenHcmIds = new Set<string>()
  let curDayPositions = dayPositions
  let sequenceMode = dayHeaderIdx < 0 // use sequence mapping if no day header found

  let i = dataStart
  while (i < lines.length) {
    const line = lines[i]
    if (!line?.trim()) { i++; continue }

    // Detect new day-header (multi-dept)
    const newPos = tryBuildDayPositions(line, startDay, startMonth, startYear)
    if (newPos && newPos.length >= 5 && i > (dayHeaderIdx >= 0 ? dayHeaderIdx : 0)) {
      curDayPositions = newPos
      sequenceMode = false
      i += 2
      continue
    }

    const hcmId = extractHcmId(line)
    if (!hcmId) { i++; continue }

    seenHcmIds.add(hcmId)
    const nextLine = i + 1 < lines.length ? lines[i + 1] : ""

    let pairs: Array<{ dateStr: string; inTime: string | null; outTime: string | null }>

    if (!sequenceMode && curDayPositions.length > 0) {
      // Position-based: map times by character offset to day columns
      pairs = buildPairsFromPositions(line, nextLine, curDayPositions)
    } else {
      // Sequence-based: times appear left-to-right in date order
      // Use allDates to assign: skip weekends? No — just use ALL dates in order.
      pairs = buildPairsFromSequence(line, nextLine, allDates)
    }

    for (const p of pairs) {
      if (p.inTime !== null || p.outTime !== null) {
        rawRows.push({ code: hcmId, date: p.dateStr, inTime: p.inTime, outTime: p.outTime })
      }
    }

    i += 2
  }

  if (rawRows.length === 0) {
    throw new Error(
      "No attendance records found. " +
        (dayHeaderIdx < 0 ? "Day-number header not found (sequence mode used). " : "") +
        "Please confirm this is a Union Developers Monthly IN-OUT Report."
    )
  }

  return { format: "crystal-report", rows: rawRows, codes: [...seenHcmIds], dateRangeLabel }
}

// ── Position-based pair builder ───────────────────────────────────────────────

function buildPairsFromPositions(
  inLine: string,
  outLine: string,
  dayPositions: Array<{ pos: number; dateStr: string }>
) {
  const inMap = extractTimesMap(inLine, dayPositions)
  const outMap = extractTimesMap(outLine, dayPositions)
  const all = new Set([...inMap.keys(), ...outMap.keys()])
  return [...all].map(d => ({ dateStr: d, inTime: inMap.get(d) ?? null, outTime: outMap.get(d) ?? null }))
}

function extractTimesMap(
  line: string,
  dayPositions: Array<{ pos: number; dateStr: string }>
): Map<string, string> {
  const TOL = 10
  const result = new Map<string, string>()
  const re = /\b(\d{1,2}:\d{2})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    let nearest: (typeof dayPositions)[0] | null = null
    let minDist = Infinity
    for (const col of dayPositions) {
      const d = Math.abs(m.index - col.pos)
      if (d < minDist && d <= TOL) { minDist = d; nearest = col }
    }
    if (nearest && !result.has(nearest.dateStr)) result.set(nearest.dateStr, m[1])
  }
  return result
}

// ── Sequence-based pair builder ───────────────────────────────────────────────

function buildPairsFromSequence(inLine: string, outLine: string, allDates: string[]) {
  const inTimes = extractTimesSequence(inLine)
  const outTimes = extractTimesSequence(outLine)
  const count = Math.max(inTimes.length, outTimes.length)
  const pairs = []
  for (let j = 0; j < count && j < allDates.length; j++) {
    pairs.push({
      dateStr: allDates[j],
      inTime: inTimes[j] ?? null,
      outTime: outTimes[j] ?? null,
    })
  }
  return pairs
}

function extractTimesSequence(line: string): string[] {
  return (line.match(/\b\d{1,2}:\d{2}\b/g) ?? [])
}

// ── Day-header detection ──────────────────────────────────────────────────────

function tryBuildDayPositions(
  line: string,
  startDay: number,
  startMonth: number,
  startYear: number
): Array<{ pos: number; dateStr: string }> | null {
  if (!line?.trim()) return null

  const positions: Array<{ pos: number; dateStr: string }> = []

  // Match all standalone 1-2 digit integers in the line
  const re = /(?<![\d:])\b(\d{1,2})\b(?![:\d])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    const n = parseInt(m[1], 10)
    if (n < 1 || n > 31) continue
    let year = startYear, month = startMonth
    if (n < startDay) {
      month++
      if (month > 11) { month = 0; year++ }
    }
    const dateStr = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(n).padStart(2, "0")
    positions.push({ pos: m.index, dateStr })
  }

  // Must find ≥5 day numbers AND the line must NOT contain HH:MM times
  if (positions.length >= 5 && !/ \d{1,2}:\d{2}/.test(line)) return positions
  return null
}

// ── HCM ID extraction ─────────────────────────────────────────────────────────

function extractHcmId(line: string): string | null {
  const m = line.trimStart().match(/^(\d{4,10})(?:\s*\/|\s+[A-Za-z])/)
  return m ? m[1] : null
}
