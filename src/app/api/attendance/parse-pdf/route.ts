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

    const lines = fullText.split(/\r?\n/).map((l: string) => l.trimEnd())

    if (debug) {
      return json({
        debug: true,
        numpages: data.numpages,
        lines: lines.slice(0, 120),
        text: fullText.slice(0, 10000),
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
// PDF structure (one line per item):
//   "Monthly IN-OUT Report"
//   "Union Developers"
//   "For Date: 2026/03/21 to 2026/04/08"
//   "Division:"
//   "21 "          <- day number (may have trailing space, or "27 Fri28 " combined)
//   "Sat"          <- day name (skip)
//   "22 "
//   "Sun"
//   ... (18 dates × 2 lines = 36 lines of day headers)
//   " 200201 / Hamza Khan   /"    <- employee line (HCM ID at start)
//   "Assistant Manager Finance"  <- designation line (skip)
//   " "            <- blank/space = no punch
//   " "
//   "10:10"        <- in-time for day N
//   " "            <- out-time for day N (absent/missing)
//   "10:05"        <- in-time for day N+1
//   ...  (alternating IN / OUT, 2 lines per date)
//   [next employee line or page footer / new day header block]
//
// Key insight: after the employee + designation lines, the next block contains
// exactly (numDates * 2) lines of punch data (in strict IN/OUT alternation).
// A " " (space-only) line means no punch for that slot.
// Page footers and repeated day-header blocks are detected and skipped.

function parseCrystalReport(lines: string[]): ParseResult {
  // ── 1. Find "For Date:" ─────────────────────────────────────────────────
  let reportStart: Date | null = null
  let reportEnd: Date | null = null
  let dateRangeLabel = ""
  let forDateIdx = -1

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].replace(/\s+/g, " ").match(/for date[: ]+(\d[\d/]+) to (\d[\d/]+)/i)
    if (m) {
      reportStart = new Date(m[1].replace(/\//g, "-"))
      reportEnd = new Date(m[2].replace(/\//g, "-"))
      dateRangeLabel = m[1] + " to " + m[2]
      forDateIdx = i
      break
    }
  }

  if (!reportStart || isNaN(reportStart.getTime())) {
    throw new Error("Crystal Report: could not find 'For Date:' header.")
  }

  // ── 2. Build ordered date list ─────────────────────────────────────────
  const allDates: string[] = []
  const cur = new Date(reportStart)
  const endDate = new Date(reportEnd!)
  endDate.setDate(endDate.getDate() + 1) // make end exclusive
  while (cur < endDate) {
    allDates.push(
      cur.getFullYear() +
        "-" +
        String(cur.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(cur.getDate()).padStart(2, "0")
    )
    cur.setDate(cur.getDate() + 1)
  }
  const numDates = allDates.length // e.g. 19

  // ── 3. Parse employee blocks ────────────────────────────────────────────
  const rawRows: RawRow[] = []
  const seenCodes = new Set<string>()

  // An employee line starts with optional spaces then digits/HCM ID
  // Pattern: " 200201 / Hamza Khan   /" or " 200201 / Name / "
  const EMP_RE = /^\s*(\d{4,10})\s*\/\s*.+/

  let i = forDateIdx + 1

  while (i < lines.length) {
    const line = lines[i]

    // Check if this is an employee line
    const empMatch = line.match(EMP_RE)
    if (!empMatch) {
      i++
      continue
    }

    const hcmId = empMatch[1]
    seenCodes.add(hcmId)

    // Skip the designation line (line i+1)
    // Then read numDates * 2 punch lines starting at i+2
    const punchStart = i + 2
    const punches: string[] = []

    let j = punchStart
    let collected = 0
    while (j < lines.length && collected < numDates * 2) {
      const pl = lines[j]

      // Stop if we hit a new employee line
      if (EMP_RE.test(pl)) break

      // Skip page footer lines (contain "Page X of Y" or "Print Date" or "Department:")
      if (
        /page\s+\d+\s+of\s+\d+/i.test(pl) ||
        /print date/i.test(pl) ||
        /^department:/i.test(pl) ||
        /^\d{2}\/\d{2}\/\d{4}/.test(pl.trim())
      ) {
        j++
        continue
      }

      // Skip day-header repetitions (lines that are just day numbers or day names)
      // Day number lines: optional spaces + 1-2 digits optionally followed by " FriXX " etc
      if (/^\s*(?:\d{1,2}\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*\d{0,2}\s*|\d{1,2}\s*)$/.test(pl)) {
        j++
        continue
      }
      // Day name lines: just the day abbreviation
      if (/^\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*$/.test(pl)) {
        j++
        continue
      }

      // This is a punch line: either a time "HH:MM" or a blank/space
      punches.push(pl.trim())
      collected++
      j++
    }

    // Map punches to dates: even indices (0,2,4...) = IN, odd (1,3,5...) = OUT
    for (let d = 0; d < numDates && d * 2 < punches.length; d++) {
      const inRaw = punches[d * 2] ?? ""
      const outRaw = punches[d * 2 + 1] ?? ""
      const inTime = /^\d{1,2}:\d{2}$/.test(inRaw) ? inRaw : null
      const outTime = /^\d{1,2}:\d{2}$/.test(outRaw) ? outRaw : null
      if (inTime !== null || outTime !== null) {
        rawRows.push({ code: hcmId, date: allDates[d], inTime, outTime })
      }
    }

    // Advance past this employee's block
    i = j
  }

  if (rawRows.length === 0) {
    throw new Error(
      "No attendance records found. Please confirm this is a Union Developers Monthly IN-OUT Report."
    )
  }

  return {
    format: "crystal-report",
    rows: rawRows,
    codes: [...seenCodes],
    dateRangeLabel,
  }
}
