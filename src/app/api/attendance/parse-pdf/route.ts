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

interface PdfTextItem {
  str: string
  x: number
  y: number
  pageNum: number
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

async function parseCrystalReportPdf(buffer: Buffer): Promise<ParseResult> {
  // pdfjs-dist v3.x — legacy build for Node.js/Vercel serverless
  // In v3, setting workerSrc="" disables the web worker and runs pdfjs inline
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs" as any) as typeof import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = ""

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise

  const allItems: PdfTextItem[] = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const textContent = await page.getTextContent()
    for (const item of textContent.items) {
      if (!("str" in item)) continue
      const str = (item as { str: string }).str.trim()
      if (!str) continue
      const transform = (item as { transform: number[] }).transform
      const x = transform[4]
      const y = viewport.height - transform[5]
      allItems.push({ str, x, y, pageNum })
    }
  }

  if (allItems.length === 0)
    throw new Error(
      "PDF appears to be empty or is image-only (scanned). Text extraction requires a digital PDF."
    )

  const Y_TOLERANCE = 4
  allItems.sort((a, b) => a.pageNum - b.pageNum || a.y - b.y || a.x - b.x)

  const visualRows: PdfTextItem[][] = []
  let currentRow: PdfTextItem[] = []
  let lastY = -1
  let lastPage = -1

  for (const item of allItems) {
    const newRow = item.pageNum !== lastPage || Math.abs(item.y - lastY) > Y_TOLERANCE
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

  let reportStartDate: Date | null = null
  let dateRangeLabel = ""
  let dateCols: Array<{ x: number; dateStr: string }> = []
  const rawRows: RawRow[] = []
  const seenHcmIds = new Set<string>()

  type State = "seek-date" | "seek-day-header" | "skip-day-names" | "employees"
  let state: State = "seek-date"
  let pendingIn: { hcmId: string; times: Map<string, string> } | null = null

  for (const row of visualRows) {
    const rowText = row.map((i) => i.str).join(" ")

    if (state === "seek-date") {
      const m = rowText.match(/for\s+date[:\s]+([\d/]+)\s+to\s+([\d/]+)/i)
      if (m) {
        reportStartDate = new Date(m[1].replace(/\//g, "-"))
        dateRangeLabel = m[1] + " to " + m[2]
        state = "seek-day-header"
      }
      continue
    }

    if (
      (state === "seek-day-header" || state === "employees") &&
      reportStartDate
    ) {
      const numericItems = row.filter((item) => {
        const n = parseInt(item.str, 10)
        return !isNaN(n) && n >= 1 && n <= 31 && /^\d{1,2}$/.test(item.str) && item.x > 80
      })
      if (numericItems.length >= 5) {
        dateCols = buildDateCols(numericItems, reportStartDate)
        pendingIn = null
        state = "skip-day-names"
        continue
      }
    }

    if (state === "skip-day-names") {
      state = "employees"
      continue
    }

    if (state === "employees" && dateCols.length > 0) {
      const firstItem = row[0]
      const hcmId = firstItem ? extractHcmId(firstItem.str) : null
      if (hcmId) {
        pendingIn = { hcmId, times: extractTimes(row, dateCols) }
        seenHcmIds.add(hcmId)
      } else if (pendingIn) {
        const outTimes = extractTimes(row, dateCols)
        const allDates = new Set([...pendingIn.times.keys(), ...outTimes.keys()])
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

function buildDateCols(
  numericItems: PdfTextItem[],
  startDate: Date
): Array<{ x: number; dateStr: string }> {
  const startDay = startDate.getDate()
  const startMonth = startDate.getMonth()
  const startYear = startDate.getFullYear()
  return numericItems.map((item) => {
    const dayNum = parseInt(item.str, 10)
    let year = startYear
    let month = startMonth
    if (dayNum < startDay) {
      month++
      if (month > 11) { month = 0; year++ }
    }
    const dateStr = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(dayNum).padStart(2, "0")
    return { x: item.x, dateStr }
  })
}

function extractTimes(
  row: PdfTextItem[],
  dateCols: Array<{ x: number; dateStr: string }>
): Map<string, string> {
  const X_TOLERANCE = 18
  const result = new Map<string, string>()
  for (const item of row) {
    if (!/^\d{1,2}:\d{2}$/.test(item.str)) continue
    let nearest: { x: number; dateStr: string } | null = null
    let minDist = Infinity
    for (const col of dateCols) {
      const dist = Math.abs(item.x - col.x)
      if (dist < minDist && dist <= X_TOLERANCE) {
        minDist = dist
        nearest = col
      }
    }
    if (nearest && !result.has(nearest.dateStr)) {
      result.set(nearest.dateStr, item.str)
    }
  }
  return result
}

function extractHcmId(text: string): string | null {
  const cleaned = String(text ?? "").replace(/[\r\n]+/g, " ").trim()
  const m = cleaned.match(/^(\d{4,10})/)
  return m ? m[1] : null
}
