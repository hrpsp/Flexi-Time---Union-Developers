# PDF Import — Implementation Notes
## Flexi Time · Union Developers

---

## What Was Built

PDF support for the Monthly IN-OUT Crystal Report. HR can now upload the PDF directly
without any conversion step. The existing 4-step wizard (Upload → Match → Preview → Sync)
is completely unchanged from Step 2 onwards.

---

## Files Changed

### 1. `src/app/api/attendance/parse-pdf/route.ts` — NEW
Server-side API route that accepts a multipart PDF upload, parses it using
`pdfjs-dist`, and returns the same `ParseResult` JSON shape as the client-side
Excel parser. Handles:
- Multi-department structure (re-detects column headers per department section)
- All 32+ pages in one pass
- Row A = in-times, Row B = out-times pairing
- Overnight/night-shift workers (passes null-safe in/out to existing `calcStatus`)
- File size limit: 25 MB
- Scanned/image PDFs: returns a clear error message

### 2. `src/components/attendance/upload-dialog.tsx` — MODIFIED
Four targeted changes:
- `handleFiles` — now accepts `.pdf` alongside `.xlsx/.xls/.xlsm`
- `handleParse` — PDF files are sent to `/api/attendance/parse-pdf` as
  `multipart/form-data`; Excel files still use the existing client-side SheetJS parser
- Dialog subtitle updated: "Crystal Report PDF or Excel Import"
- Drop zone label, `accept` attribute, and help text updated for PDF

### 3. `next.config.mjs` — MODIFIED
Added `serverExternalPackages: ["pdfjs-dist"]` so webpack does not attempt
to bundle the library for server-side routes (it relies on Node.js native APIs).

---

## One-Time Setup (developer action required)

```bash
npm install pdfjs-dist
```

This is the only new dependency. No other packages needed.

---

## How the PDF Parser Works

```
PDF Upload
    │
    ▼
POST /api/attendance/parse-pdf
    │
    ├── pdfjs-dist: extract all text items with X/Y coordinates (all pages)
    │
    ├── Cluster items into visual rows (Y-tolerance: 4 points)
    │
    ├── Find "For Date: YYYY/MM/DD to YYYY/MM/DD" → parse report date range
    │
    ├── For each department section (detected by ≥5 integers 1–31 in non-first column):
    │     ├── Build column X-position → YYYY-MM-DD map
    │     ├── Skip day-of-week row
    │     └── Process employee row pairs:
    │           Row A (HCM ID regex matches) → in-times by column X
    │           Row B (no HCM ID)            → out-times by column X
    │
    └── Return: { format: "crystal-report", rows: RawRow[], codes: string[], dateRangeLabel }
         │
         ▼  (identical to Excel path from here)
    Step 2: Match HCM IDs against Employee table
    Step 3: Preview with calculated statuses
    Step 4: Sync to AttendanceRecord table
```

---

## Key Design Decisions

**Column matching by X position (tolerance ±18pt)**
PDF text items have floating-point X coordinates that may drift slightly from
the column header X positions. A ±18 point tolerance absorbs this without
mis-assigning times to adjacent columns.

**Multi-department fix included**
The PDF parser naturally handles multiple department sections by re-detecting
the day-number header row on each encounter. This also fixes the equivalent
bug in the Excel parser where only the first department was processed.

**No intermediate XLSX conversion**
The PDF is parsed directly to `RawRow[]`, skipping the unnecessary
PDF→Excel→parse chain. This is more reliable and avoids conversion artifacts.

**Night-shift workers**
The parser emits raw `inTime` / `outTime` strings as-is. The existing
`calcStatus()` function already handles overnight shifts (outTime < inTime → add 1440 min).

**Scanned PDFs**
If `pdfjs-dist` extracts zero text items, the route returns a clear error:
_"PDF appears to be empty or is image-only (scanned). Text extraction requires a digital PDF."_

---

## Testing Checklist

- [ ] Upload the 32-page Crystal Report PDF provided by HR
- [ ] Verify all department sections are parsed (not just Department 10)
- [ ] Confirm HCM IDs match against the Employee table in Step 2
- [ ] Check night-shift employees (e.g., employees punching in at 20:xx, out at 2:xx)
- [ ] Confirm employees with zero punches produce no `RawRow` entries (no errors)
- [ ] Verify the "For Date" badge shows the correct period in Step 2
- [ ] Test with a scanned PDF — should show a clear error, not a crash
- [ ] Test Excel upload still works (existing path unchanged)
- [ ] Deploy to Vercel — confirm function completes within 60s timeout

---

## Vercel Runtime Notes

- Route uses `export const runtime = "nodejs"` (not Edge) — required for pdfjs-dist
- `export const maxDuration = 60` — 32-page PDF parses in ~5–10s but allows headroom
- `serverExternalPackages: ["pdfjs-dist"]` in `next.config.mjs` prevents webpack bundling

