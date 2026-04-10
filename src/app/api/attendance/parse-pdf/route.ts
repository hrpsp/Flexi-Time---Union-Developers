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

    // Use a custom render to get better layout preservation
    const pages: string[] = []
    const data = await pdfParse(buffer, {
      // Custom page render that captures each page's text separately
      pagerender: (pageData: any) => { // eslint-disable-line
        return pageData.getTextContent().then((content: any) => { // eslint-disable-line
          // Sort text items by Y position (top to bottom), then X (left to right)
          const items = (content.items as any[]) // eslint-disable-line
            .filter((item: any) => item.str?.trim()) // eslint-disable-line
            .sort((a: any, b: any) => { // eslint-disable-line
              const yDiff = Math.round(b.transform[5]) - Math.round(a.transform[5])
              if (yDiff !== 0) return yDiff
              return a.transform[4] - b.transform[4]
            })

          // Group into rows by Y coordinate (within 3pt tolerance)
          const rows: string[][] = []
          let curRow: string[] = []
          let lastY = -9999

          for (const item of items) {
            const y = Math.round(item.transform[5])
            if (Math.abs(y - lastY) > 3 && curRow.length > 0) {
              rows.push(curRow)
              curRow = []
            }
            curRow.push(item.str)
            lastY = y
          }
          if (curRow.length > 0) rows.push(curRow)

          // Join each row's items with a tab, rows with newline
          const pageText = rows.map(r => r.join("\t")).join("\n")
          pages.push(pageText)
          return pageText
        })
      }
    })

    const fullText = pages.length > 0 ? pages.join("\n") : data.text

    if (!fullText.trim()) {
      throw new Error("PDF appears to be empty or image-only (scanned). Text extraction requires a digital PDF.")
    }

    if (debug) {
      return json({
        debug: true,
        numpages: data.numpages,
        text: fullText.slice(0, 10000),
        lines: fullText.split("\n").slice(0, 60)
      })
    }

    const result = parseCrystalReport(fullText)
    return json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse PDF."
    return json({ error: message }, 422)
  }
}

// ── Crystal Report Parser ─────────────────────────────────────────────────────

function parseCrystalReport(fullText: string): ParseResult {
  const lines = fullText.split("\n").map(l => l.trimEnd())

  // ── 1. Find "For Date:" ────────────────────────────────────────────────
  let reportStart: Date | null = null
  let reportEnd: Date | null = null
  let dateRangeLabel = ""
  let forDateIdx = -1

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/for\s*date[:\s]+(\d[\d/]+)\s+to\s+(\d[\d/]+)/i)
      || lines[i].match(/for\s*date[:\s]+(\d[\d-]+)\s+to\s+(\d[\d-]+)/i)
    if (m) {
      reportStart = new Date(m[1].replace(/\//g, "-"))
      reportEnd = new Date(m[2].replace(/\//g, "-"))
      dateRangeLabel = m[1] + " to " + m[2]
      forDateIdx = i
      break
    }
  }

  if (!reportStart || isNaN(reportStart.getTime())) {
    // Also try tab-separated
    for (let i = 0; i < lines.length; i++) {
      const joined = lines[i].replace(/\t/g, " ")
      const m = joined.match(/for\s*date[:\s]+(\d[\d/]+)\s+to\s+(\d[\d/]+)/i)
      if (m) {
        reportStart = new Date(m[1].replace(/\//g, "-"))
        reportEnd = new Date(m[2].replace(/\//g, "-"))
        dateRangeLabel = m[1] + " to " + m[2]
        forDateIdx = i
        break
      }
    }
  }

  if (!reportStart || isNaN(reportStart.getTime())) {
    throw new Error("Crystal Report: could not parse the 'For Date:' range. Preview: " + lines.slice(0, 10).join(" | "))
  }

  const startDay = reportStart.getDate()
  const startMonth = reportStart.getMonth()
  const startYear = reportStart.getFullYear()

  // ── 2. Find day-number header row ──────────────────────────────────────
  // Look for a line (tab-delimited or space-delimited) where tokens are mostly 1-31 integers
  let dayHeaderIdx = -1
  let dayPositions: Array<{ pos: number; dateStr: string }> = []

  for (let i = forDateIdx + 1; i < Math.min(lines.length, forDateIdx + 40); i++) {
    const result = tryParseDayHeader(lines[i], startDay, startMonth, startYear)
    if (result && result.length >= 5) {
      dayHeaderIdx = i
      dayPositions = result
      break
    }
  }

  if (dayHeaderIdx === -1) {
    const sample = lines.slice(forDateIdx, forDateIdx + 25).join("\n")
    throw new Error(
      "Crystal Report: could not find the day-number header row. " +
        "Sample after For Date: " + JSON.stringify(sample.slice(0, 500))
    )
  }

  // ── 3. Parse employee pairs ────────────────────────────────────────────
  // Skip the day-of-week abbreviation row (next line after day numbers)
  const dataStart = dayHeaderIdx + 2
  const rawRows: RawRow[] = []
  const seenHcmIds = new Set<string>()
  let curDayPositions = dayPositions

  let i = dataStart
  while (i < lines.length) {
    const line = lines[i]
    if (!line?.trim()) { i++; continue }

    // Check if this is a new day-number header row (multi-department)
    const newDayPos = tryParseDayHeader(line, startDay, startMonth, startYear)
    if (newDayPos && newDayPos.length >= 5 && i > dayHeaderIdx) {
      curDayPositions = newDayPos
      i += 2 // skip this header + day-of-week row
      continue
    }

    const hcmId = extractHcmId(line)
    if (hcmId) {
      seenHcmIds.add(hcmId)
      const inTimes = extractTimes(line, curDayPositions)
      const outLine = i + 1 < lines.length ? lines[i + 1] : ""
      const outTimes = extractTimes(outLine, curDayPositions)

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
      "No attendance records found. Please confirm this is a Union Developers Monthly IN-OUT Report."
    )
  }

  return { format: "crystal-report", rows: rawRows, codes: [...seenHcmIds], dateRangeLabel }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tryParseDayHeader(
  line: string,
  startDay: number,
  startMonth: number,
  startYear: number
): Array<{ pos: number; dateStr: string }> | null {
  if (!line?.trim()) return null

  // Try both tab and space delimiters
  const positions: Array<{ pos: number; dateStr: string }> = []

  // Try tab-delimited first (from our custom render)
  const tabTokens = line.split("\t")
  if (tabTokens.length >= 5) {
    let allDayNums = true
    for (const t of tabTokens) {
      const n = parseInt(t.trim(), 10)
      if (isNaN(n) || n < 1 || n > 31 || !/^\d{1,2}$/.test(t.trim())) {
        allDayNums = false
        break
      }
    }
    if (allDayNums) {
      let pos = 0
      for (const t of tabTokens) {
        const dayNum = parseInt(t.trim(), 10)
        const dateStr = calcDateStr(dayNum, startDay, startMonth, startYear)
        positions.push({ pos, dateStr })
        pos += t.length + 1 // +1 for tab
      }
      return positions
    }
  }

  // Try space-delimited: find all standalone 1-2 digit numbers
  const re = /(?:^|\s)(\d{1,2})(?=\s|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    const dayNum = parseInt(m[1], 10)
    if (dayNum < 1 || dayNum > 31) continue
    const dateStr = calcDateStr(dayNum, startDay, startMonth, startYear)
    positions.push({ pos: m.index + (m[0].length - m[1].length), dateStr })
  }

  // Must have at least 5 day numbers that are plausible day-of-month values
  if (positions.length >= 5) return positions
  return null
}

function calcDateStr(dayNum: number, startDay: number, startMonth: number, startYear: number): string {
  let year = startYear
  let month = startMonth
  if (dayNum < startDay) {
    month++
    if (month > 11) { month = 0; year++ }
  }
  return year + "-" + String(month + 1).padStart(2, "0") + "-" + String(dayNum).padStart(2, "0")
}

function extractHcmId(line: string): string | null {
  // HCM ID: 4-10 digits at start of line, followed by slash, tab, or whitespace+letter
  const m = line.trimStart().match(/^(\d{4,10})(?:\s*\/|\t|\s+[A-Za-z])/)
  return m ? m[1] : null
}

function extractTimes(
  line: string,
  dayPositions: Array<{ pos: number; dateStr: string }>
): Map<string, string> {
  const X_TOL = 10 // character tolerance for position matching
  const result = new Map<string, string>()
  const re = /\b(\d{1,2}:\d{2})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    const charPos = m.index
    let nearest: (typeof dayPositions)[0] | null = null
    let minDist = Infinity
    for (const col of dayPositions) {
      const dist = Math.abs(charPos - col.pos)
      if (dist < minDist && dist <= X_TOL) { minDist = dist; nearest = col }
    }
    if (nearest && !result.has(nearest.dateStr)) {
      result.set(nearest.dateStr, m[1])
    }
  }
  return result
}
