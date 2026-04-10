import { withPermission, json } from "@/lib/with-permission"

// ──────────────────────────────────────────────────────────────────────────────
// PDF Crystal Report Parser
//
// Accepts a multipart/form-data PDF upload and parses the Union Developers
// Monthly IN-OUT Report format using pdfjs-dist (text + coordinate extraction).
//
// Returns the same ParseResult shape that the client-side Excel parser returns,
// so Steps 2–4 of the upload wizard (Match → Preview → Sync) are unchanged.
//
// Key behaviours:
//  • Processes all 32+ pages in one pass
//  • Re-detects the day-number header row per department section
//    (fixes the multi-department bug that exists in the Excel parser)
//  • Row A (HCM ID row) = in-times;  Row B (designation row) = out-times
//  • Overnight shifts (outTime < inTime) are handled downstream by calcStatus
//  • Unmatched HCM IDs are silently skipped at sync (existing behaviour)
// ──────────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs"        // pdfjs-dist requires Node.js runtime
export const maxDuration = 60          // allow up to 60s for large PDFs on Vercel

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawRow {
  code: string
  date: string        // YYYY-MM-DD
  inTime: string | null
  outTime: string | null
}

interface ParseResult {
  format: "crystal-report"
  rows: RawRow[]
  codes: string[]
  dateRangeLabel: string
}

/** A single text item extracted from a PDF page, with normalised coordinates */
interface PdfTextItem {
  str: string
  x: number           // distance from left edge of page (points)
  y: number           // distance from TOP of page (points) — normalised from PDF bottom-up
  pageNum: number
}

// ── Route handler ─────────────────────────────────────────────────────────────

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

// ── Core PDF parser ───────────────────────────────────────────────────────────

async function parseCrystalReportPdf(buffer: Buffer): Promise<ParseResult> {
  // Dynamic import keeps pdfjs-dist out of the client bundle entirely.
  // GlobalWorkerOptions.workerSrc = "" disables the web worker, which is
  // required for Node.js / Vercel serverless execution.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs" as never) as typeof import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = ""

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise

  // ── 1. Extract all text items with page-normalised coordinates ─────────────
  const allItems: PdfTextItem[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const textContent = await page.getTextContent()

    for (const item of textContent.items) {
      if (!("str" in item)) continue
      const str = item.str.trim()
      if (!str) continue
      // PDF coordinate origin is bottom-left; convert Y to top-down.
      const x = item.transform[4]
      const y = viewport.height - item.transform[5]
      allItems.push({ str, x, y, pageNum })
    }
  }

  if (allItems.length === 0)
    throw new Error("PDF appears to be empty or is image-only (scanned). Text extraction requires a digital PDF.")

  // ── 2. Cluster text items into visual rows ─────────────────────────────────
  // Items on the same page within Y_TOLERANCE points share a row.
  const Y_TOLERANCE = 4   // points
  allItems.sort((a, b) => a.pageNum - b.pageNum || a.y - b.y || a.x - b.x)

  const visualRows: PdfTextItem[][] = []
  let currentRow: PdfTextItem[] = []
  let lastY = -1
  let lastPage = -1

  for (const item of allItems) {
    const newRow =
      item.pageNum !== lastPage ||
      Math.abs(item.y - lastY) > Y_TOLERANCE

    if (newRow) {
      if (currentRow.length > 0) visualRows.push([...currentRow])
      currentRow = [item]
      lastY = item.y
      lastPage = item.pageNum
    } else {
      currentRow.push(item)
    }
  }
  if (currentRow.length > 0) visualRows.push(currentRow)

  // ── 3. Parse the Crystal Report structure ──────────────────────────────────

  // The "For Date:" row is global (page 1 header) and applies to the whole report.
  let reportStartDate: Date | null = null
  let dateRangeLabel = ""

  // Per-department column map: X position → YYYY-MM-DD date string.
  // This is rebuilt every time a new day-number header row is detected,
  // correctly handling the multi-department structure across 32+ pages.
  let dateCols: Array<{ x: number; dateStr: string }> = []

  const rawRows: RawRow[] = []
  const seenHcmIds = new Set<string>()

  // Simple state machine
  type State = "seek-date" | "seek-day-header" | "skip-day-names" | "employees"
  let state: State = "seek-date"

  // Row A (HCM ID row) for the current employee pair
  let pendingIn: { hcmId: string; times: Map<string, string> } | null = null

  for (const row of visualRows) {
    const rowText = row.map((i) => i.str).join(" ")

    // ── Detect "For Date:" (global header — only need once) ─────────────────
    if (state === "seek-date") {
      const m = rowText.match(/for\s+date[:\s]+([\d/]+)\s+to\s+([\d/]+)/i)
      if (m) {
        reportStartDate = new Date(m[1].replace(/\//g, "-"))
        dateRangeLabel = `${m[1]} to ${m[2]}`
        state = "seek-day-header"
      }
      continue
    }

    // ── Detect day-number header row (≥ 5 integers 1–31 beyond col 0) ───────
    // This fires for EVERY department section, rebuilding dateCols each time.
    if (
      (state === "seek-day-header" || state === "employees") &&
      reportStartDate
    ) {
      const numericItems = row.filter((item) => {
        const n = parseInt(item.str, 10)
        return (
          !isNaN(n) &&
          n >= 1 &&
          n <= 31 &&
          /^\d{1,2}$/.test(item.str) &&
          item.x > 80   // exclude the first-column employee label area
        )
      })

      if (numericItems.length >= 5) {
        dateCols = buildDateCols(numericItems, reportStartDate)
        pendingIn = null          // reset any dangling in-row on new department
        state = "skip-day-names" // next row is the day-of-week row — skip it
        continue
      }
    }

    // ── Skip the day-of-week row (Sat / Sun / Mon …) ────────────────────────
    if (state === "skip-day-names") {
      state = "employees"
      continue
    }

    // ── Process employee row pairs ───────────────────────────────────────────
    if (state === "employees" && dateCols.length > 0) {
      const firstItem = row[0]
      const hcmId = firstItem ? extractHcmId(firstItem.str) : null

      if (hcmId) {
        // Row A — in-time row
        pendingIn = { hcmId, times: extractTimes(row, dateCols) }
        seenHcmIds.add(hcmId)
      } else if (pendingIn) {
        // Row B — out-time row for the preceding in-time row
        const outTimes = extractTimes(row, dateCols)

        const allDates = new Set([
          ...pendingIn.times.keys(),
          ...outTimes.keys(),
        ])

        for (const dateStr of allDates) {
          rawRows.push({
            code: pendingIn.hcmId,
            date: dateStr,
            inTime: pendingIn.times.get(dateStr) ?? null,
            outTime: outTimes.get(dateStr) ?? null,
          })
        }

        pendingIn = null
      }
      // Otherwise: blank row, "Department:" label, "Division:" etc — skip
    }
  }

  if (rawRows.length === 0)
    throw new Error(
      "No attendance records could be extracted from the PDF. " +
      "Please confirm this is a Union Developers Monthly IN-OUT Report (digital PDF, not scanned)."
    )

  return {
    format: "crystal-report",
    rows: rawRows,
    codes: [...seenHcmIds],
    dateRangeLabel,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build the column X-position → date map from the day-number header row.
 * Days >= startDay belong to the start month; days < startDay roll to the next month.
 */
function buildDateCols(
  numericItems: PdfTextItem[],
  startDate: Date
): Array<{ x: number; dateStr: string }> {
  const startDay   = startDate.getDate()
  const startMonth = startDate.getMonth()
  const startYear  = startDate.getFullYear()

  return numericItems.map((item) => {
    const dayNum = parseInt(item.str, 10)
    let year  = startYear
    let month = startMonth

    if (dayNum < startDay) {
      month++
      if (month > 11) { month = 0; year++ }
    }

    return {
      x: item.x,
      dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`,
    }
  })
}

/**
 * Extract "HH:MM" time strings from a row, mapped to their nearest column date.
 * Uses X_TOLERANCE to handle minor horizontal drift in PDF text positioning.
 */
function extractTimes(
  row: PdfTextItem[],
  dateCols: Array<{ x: number; dateStr: string }>
): Map<string, string> {
  const X_TOLERANCE = 18   // points — generous enough to absorb PDF rounding
  const result = new Map<string, string>()

  for (const item of row) {
    if (!/^\d{1,2}:\d{2}$/.test(item.str)) continue   // not a time value

    let nearest: { x: number; dateStr: string } | null = null
    let minDist = Infinity

    for (const col of dateCols) {
      const dist = Math.abs(item.x - col.x)
      if (dist < minDist && dist <= X_TOLERANCE) {
        minDist = dist
        nearest = col
      }
    }

    // Take the first time seen for a given date (avoids duplicates from
    // multi-line cells; the second value, if any, is the out-time in Row B)
    if (nearest && !result.has(nearest.dateStr)) {
      result.set(nearest.dateStr, item.str)
    }
  }

  return result
}

/**
 * Extract the leading numeric HCM ID from Crystal Report first-column text.
 * Examples:
 *   "200201 / Hamza Khan"        → "200201"
 *   "200201 / Hamza\nAssistant"  → "200201"
 *   "Assistant Manager Finance"  → null  (designation row — Row B)
 */
function extractHcmId(text: string): string | null {
  const cleaned = String(text ?? "").replace(/[\r\n]+/g, " ").trim()
  const m = cleaned.match(/^(\d{4,10})/)
  return m ? m[1] : null
}
