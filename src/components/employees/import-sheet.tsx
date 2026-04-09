"use client"

import { useState, useRef, useEffect, type DragEvent } from "react"
import * as XLSX from "xlsx"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  X, Upload, FileSpreadsheet, AlertCircle,
  CheckCircle2, Loader2, ArrowRight, Zap, Building2,
} from "lucide-react"h
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All system fields that can be mapped from the HCM Excel export.
 * `hcmHint` is the exact column header expected in the Union-Developers HCM sheet
 * (shown in the mapping UI so users can cross-reference their file at a glance).
 */
const SYSTEM_FIELDS = [
  // ── Identification ──────────────────────────────────────────────────────────
  { key: "hcmId",            label: "HCM ID",            required: true,  hcmHint: "HCM I.D",            group: "Identification"    },
  { key: "cnic",             label: "CNIC",               required: false, hcmHint: "CNIC",               group: "Identification",   hint: "auto-formatted"      },
  { key: "cnicIssueDate",    label: "CNIC Issue Date",    required: false, hcmHint: "CNIC Issue \u00a0",  group: "Identification"    },
  { key: "cnicExpiryDate",   label: "CNIC Expiry Date",   required: false, hcmHint: "CNIC Expiry",        group: "Identification"    },
  // ── Personal ────────────────────────────────────────────────────────────────
  { key: "name",             label: "Full Name",          required: true,  hcmHint: "Employee Name",      group: "Personal"          },
  { key: "fatherName",       label: "Father Name",        required: false, hcmHint: "Father Name",        group: "Personal"          },
  { key: "gender",           label: "Gender",             required: false, hcmHint: "Gender",             group: "Personal",         hint: "Male / Female"        },
  { key: "dateOfBirth",      label: "Date of Birth",      required: false, hcmHint: "DOB",                group: "Personal"          },
  { key: "maritalStatus",    label: "Marital Status",     required: false, hcmHint: "Marital Status",     group: "Personal",         hint: "Married / Un-Married" },
  { key: "bloodGroup",       label: "Blood Group",        required: false, hcmHint: "Blood Group",        group: "Personal",         hint: "A+ / B- / etc."       },
  { key: "religion",         label: "Religion",           required: false, hcmHint: "Religion",           group: "Personal",         hint: "Islam / Christian / Other" },
  { key: "education",        label: "Education",          required: false, hcmHint: "Education",          group: "Personal"          },
  { key: "contactNumber",    label: "Contact Number",     required: false, hcmHint: "Mobile",             group: "Personal"          },
  { key: "email",            label: "Email",              required: false, hcmHint: "\u00a0Email",        group: "Personal"          },
  { key: "address",          label: "Address",            required: false, hcmHint: "Address",            group: "Personal"          },
  // ── Emergency / NOK ─────────────────────────────────────────────────────────
  { key: "nokName",          label: "NOK Name",           required: false, hcmHint: "NOK- Name",          group: "Emergency / NOK"   },
  { key: "nokRelation",      label: "NOK Relation",       required: false, hcmHint: "NOK-Relation",       group: "Emergency / NOK"   },
  { key: "emergencyContact", label: "Emergency Contact",  required: false, hcmHint: "Emergency Contact",  group: "Emergency / NOK"   },
  // ── Employment ──────────────────────────────────────────────────────────────
  { key: "department",       label: "Department",         required: true,  hcmHint: "Department",         group: "Employment",       hint: "name or code"         },
  { key: "subDepartment",    label: "Sub-Department",     required: false, hcmHint: "Sub Department",     group: "Employment"        },
  { key: "designation",      label: "Designation",        required: false, hcmHint: "Designation",        group: "Employment"        },
  { key: "grade",            label: "Grade",              required: false, hcmHint: "Grade",              group: "Employment"        },
  { key: "pgcGrade",         label: "PGC Grade",          required: false, hcmHint: "PGC Grade",          group: "Employment"        },
  { key: "division",         label: "Division",           required: false, hcmHint: "Division",           group: "Employment",       hint: "Support Services etc." },
  { key: "project",          label: "Project",            required: false, hcmHint: "Project",            group: "Employment"        },
  { key: "doj",              label: "Date of Joining",    required: false, hcmHint: "DOJ",                group: "Employment"        },
  { key: "confirmationDate", label: "Confirmation Date",  required: false, hcmHint: "Confirmation Date",  group: "Employment"        },
] as const

type FieldKey = (typeof SYSTEM_FIELDS)[number]["key"]

// Groups in display order
const GROUPS = ["Identification", "Personal", "Emergency / NOK", "Employment"] as const

// ── Excel header alias → system field key ────────────────────────────────────
// Keys are always compared after .toLowerCase().trim() so leading/trailing
// spaces in actual headers are stripped before lookup.
const ALIASES: Record<string, FieldKey> = {
  // hcmId
  "hcm i.d":        "hcmId",
  "hcm id":         "hcmId",
  "hcmid":          "hcmId",
  "hcm":            "hcmId",
  "emp #":          "hcmId",
  "empcode":        "hcmId",
  "employee code":  "hcmId",
  "emp code":       "hcmId",
  "employee #":     "hcmId",
  "code":           "hcmId",
  // name
  "employee name":  "name",
  "name":           "name",
  "full name":      "name",
  "emp name":       "name",
  "employee":       "name",
  // fatherName
  "father name":    "fatherName",
  "father's name":  "fatherName",
  "fathername":     "fatherName",
  "father":         "fatherName",
  // designation
  "designation":    "designation",
  "job title":      "designation",
  "position":       "designation",
  "role":           "designation",
  // department
  "department":     "department",
  "dept":           "department",
  "department name":"department",
  "dept name":      "department",
  "dept code":      "department",
  "department code":"department",
  // subDepartment
  "sub department": "subDepartment",
  "subdepartment":  "subDepartment",
  "sub dept":       "subDepartment",
  // cnic
  "cnic":           "cnic",
  "nic":            "cnic",
  "national id":    "cnic",
  "cnic no":        "cnic",
  "cnic #":         "cnic",
  // cnicIssueDate  (HCM header has trailing space — trim handles it)
  "cnic issue":     "cnicIssueDate",
  "cnic issue date":"cnicIssueDate",
  "cnic issued":    "cnicIssueDate",
  // cnicExpiryDate
  "cnic expiry":    "cnicExpiryDate",
  "cnic expiry date":"cnicExpiryDate",
  "cnic exp":       "cnicExpiryDate",
  "cnic expiry date":"cnicExpiryDate",
  // gender
  "gender":         "gender",
  "sex":            "gender",
  // dateOfBirth
  "dob":            "dateOfBirth",
  "date of birth":  "dateOfBirth",
  "birth date":     "dateOfBirth",
  "birthdate":      "dateOfBirth",
  "d.o.b":          "dateOfBirth",
  // maritalStatus
  "marital status": "maritalStatus",
  "marital":        "maritalStatus",
  "maritalstatus":  "maritalStatus",
  // bloodGroup
  "blood group":    "bloodGroup",
  "bloodgroup":     "bloodGroup",
  "blood":          "bloodGroup",
  // religion
  "religion":       "religion",
  // education
  "education":      "education",
  "qualification":  "education",
  // contactNumber  (HCM uses "Mobile")
  "mobile":         "contactNumber",
  "phone":          "contactNumber",
  "contact":        "contactNumber",
  "mobile no":      "contactNumber",
  "phone no":       "contactNumber",
  "contact number": "contactNumber",
  "cell":           "contactNumber",
  // email  (HCM header has leading space — trim handles it)
  "email":          "email",
  "email address":  "email",
  "e-mail":         "email",
  // address
  "address":        "address",
  "residential address": "address",
  // nokName
  "nok- name":      "nokName",
  "nok name":       "nokName",
  "nok-name":       "nokName",
  "nokname":        "nokName",
  "next of kin name": "nokName",
  // nokRelation
  "nok-relation":   "nokRelation",
  "nok relation":   "nokRelation",
  "nokrelation":    "nokRelation",
  "nok relationship": "nokRelation",
  // emergencyContact
  "emergency contact": "emergencyContact",
  "emergency no":   "emergencyContact",
  "emergency number": "emergencyContact",
  // grade
  "grade":          "grade",
  "pay grade":      "grade",
  // pgcGrade
  "pgc grade":      "pgcGrade",
  "pgcgrade":       "pgcGrade",
  "pgc":            "pgcGrade",
  // division
  "division":       "division",
  "div":            "division",
  // project
  "project":        "project",
  "project name":   "project",
  // doj
  "doj":            "doj",
  "date of joining":"doj",
  "joining date":   "doj",
  "date joined":    "doj",
  "join date":      "doj",
  "d.o.j":          "doj",
  // confirmationDate
  "confirmation date": "confirmationDate",
  "confirmed date": "confirmationDate",
  "confirm date":   "confirmationDate",
}

// Columns in the HCM export that should be silently ignored (not mapped)
const SKIP_HEADERS = new Set(["sr. #", "sr #", "sr.", "status", "s.no", "s.no."])

const STEP_LABELS = ["Upload", "Map Columns", "Preview", "Done"] as const

// ─────────────────────────────────────────────────────────────────────────────
// Enum value mappings (Excel text → Prisma enum value)
// ─────────────────────────────────────────────────────────────────────────────

function mapGender(raw: string): "MALE" | "FEMALE" | null {
  const s = raw.trim().toLowerCase()
  if (s === "male" || s === "m") return "MALE"
  if (s === "female" || s === "f") return "FEMALE"
  return null
}

function mapMaritalStatus(raw: string): "MARRIED" | "UN_MARRIED" | null {
  const s = raw.trim().toLowerCase().replace(/[-\s]/g, "")
  if (s === "married")   return "MARRIED"
  if (s === "unmarried" || s === "single") return "UN_MARRIED"
  return null
}

function mapBloodGroup(raw: string): string | null {
  if (!raw.trim() || raw.trim() === "-") return null
  const map: Record<string, string> = {
    "a+": "A_POS", "a-": "A_NEG",
    "b+": "B_POS", "b-": "B_NEG",
    "o+": "O_POS", "o-": "O_NEG",
    "ab+": "AB_POS", "ab-": "AB_NEG",
  }
  return map[raw.trim().toLowerCase()] ?? null
}

function mapReligion(raw: string): "ISLAM" | "CHRISTIAN" | "OTHER" | null {
  const s = raw.trim().toLowerCase()
  if (s === "islam" || s === "muslim") return "ISLAM"
  if (s === "christian" || s === "christianity") return "CHRISTIAN"
  if (s && s !== "-") return "OTHER"
  return null
}

function mapDivision(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, " ")
  if (s === "support services") return "SUPPORT_SERVICES"
  if (s === "infrastructure")   return "INFRASTRUCTURE"
  if (s === "construction")     return "CONSTRUCTION"
  if (s === "commercial")       return "COMMERCIAL"
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ColMap = Partial<Record<FieldKey, string>>  // fieldKey → excel header

interface RawRow {
  hcmId: string; name: string; department: string
  fatherName: string; designation: string; cnic: string
  gender: string; dateOfBirth: string; maritalStatus: string
  bloodGroup: string; religion: string; education: string
  contactNumber: string; email: string; address: string
  nokName: string; nokRelation: string; emergencyContact: string
  grade: string; pgcGrade: string; division: string; project: string
  subDepartment: string; doj: string; confirmationDate: string
  cnicIssueDate: string; cnicExpiryDate: string
}

interface ValidatedRow extends RawRow {
  rowIndex:     number
  status:       "create" | "update" | "error"
  errors:       string[]
  departmentId: string
}

interface ImportResult {
  created: number
  updated: number
  errors:  { row: number; message: string }[]
}

interface ImportSheetProps {
  open:       boolean
  onClose:    () => void
  onImported: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024)    return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

function toStr(val: unknown): string {
  if (val == null) return ""
  if (val instanceof Date) {
    try { return format(val, "yyyy-MM-dd") } catch { return "" }
  }
  return String(val).trim()
}

function formatCnic(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13)
  if (digits.length < 13) return raw
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
}

function autoMap(headers: string[]): { colMap: ColMap; autoKeys: Set<FieldKey> } {
  const colMap: ColMap  = {}
  const autoKeys        = new Set<FieldKey>()
  for (const header of headers) {
    const normalised = header.toLowerCase().trim()
    if (SKIP_HEADERS.has(normalised)) continue
    const fieldKey = ALIASES[normalised]
    if (fieldKey && !colMap[fieldKey]) {
      colMap[fieldKey] = header
      autoKeys.add(fieldKey)
    }
  }
  return { colMap, autoKeys }
}

function readXlsx(file: File): Promise<{ headers: string[]; rawRows: Record<string, unknown>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data    = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb      = XLSX.read(data, { type: "array", cellDates: true })
        const ws      = wb.Sheets[wb.SheetNames[0]]
        // Keep original headers (with spaces) — ALIASES handles trimming
        const first   = (XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })[0] ?? []) as unknown[]
        const headers = first.map((h) => String(h ?? "")).filter((h) => h.trim())
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })
        resolve({ headers, rawRows })
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function mapRow(raw: Record<string, unknown>, colMap: ColMap): RawRow {
  const get = (field: FieldKey) => {
    const col = colMap[field]
    return col ? toStr(raw[col]) : ""
  }
  return {
    hcmId:           get("hcmId"),
    name:            get("name"),
    department:      get("department"),
    fatherName:      get("fatherName"),
    designation:     get("designation"),
    cnic:            get("cnic"),
    gender:          get("gender"),
    dateOfBirth:     get("dateOfBirth"),
    maritalStatus:   get("maritalStatus"),
    bloodGroup:      get("bloodGroup"),
    religion:        get("religion"),
    education:       get("education"),
    contactNumber:   get("contactNumber"),
    email:           get("email"),
    address:         get("address"),
    nokName:         get("nokName"),
    nokRelation:     get("nokRelation"),
    emergencyContact:get("emergencyContact"),
    grade:           get("grade"),
    pgcGrade:        get("pgcGrade"),
    division:        get("division"),
    project:         get("project"),
    subDepartment:   get("subDepartment"),
    doj:             get("doj"),
    confirmationDate:get("confirmationDate"),
    cnicIssueDate:   get("cnicIssueDate"),
    cnicExpiryDate:  get("cnicExpiryDate"),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ImportSheet({ open, onClose, onImported }: ImportSheetProps) {
  const [step,          setStep]          = useState(1)
  const [file,          setFile]          = useState<File | null>(null)
  const [headers,       setHeaders]       = useState<string[]>([])
  const [rawRows,       setRawRows]       = useState<Record<string, unknown>[]>([])
  const [colMap,        setColMap]        = useState<ColMap>({})
  const [autoKeys,      setAutoKeys]      = useState<Set<FieldKey>>(new Set())
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([])
  const [checking,      setChecking]      = useState(false)
  const [importing,     setImporting]     = useState(false)
  const [result,        setResult]        = useState<ImportResult | null>(null)
  const [newDepts,      setNewDepts]      = useState<string[]>([])
  const [dragging,      setDragging]      = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset whenever the sheet is opened
  useEffect(() => {
    if (open) {
      setStep(1); setFile(null); setHeaders([]); setRawRows([])
      setColMap({}); setAutoKeys(new Set()); setValidatedRows([]); setResult(null); setNewDepts([])
    }
  }, [open])

  if (!open) return null

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = async (f: File) => {
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Only .xlsx files are supported.")
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10 MB.")
      return
    }
    try {
      const { headers, rawRows } = await readXlsx(f)
      const { colMap, autoKeys } = autoMap(headers)
      setFile(f)
      setHeaders(headers)
      setRawRows(rawRows)
      setColMap(colMap)
      setAutoKeys(autoKeys)
      setStep(2)
    } catch {
      toast.error("Could not read the file — make sure it's a valid .xlsx.")
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  // ── Validate & go to Step 3 ────────────────────────────────────────────────

  const goToPreview = async () => {
    setChecking(true)
    try {
      const mapped = rawRows.map((r) => mapRow(r, colMap))

      const hcmIds          = [...new Set(mapped.map((r) => r.hcmId.trim()).filter(Boolean))]
      const deptIdentifiers = [...new Set(mapped.map((r) => r.department.trim()).filter(Boolean))]

      const res = await fetch("/api/employees/import/check", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ hcmIds, deptIdentifiers }),
      })
      if (!res.ok) throw new Error("Server validation failed.")
      const { existingIds, deptMap, newDepts: autoDepts = [] } = await res.json() as {
        existingIds: string[]
        deptMap:     Record<string, { id: string; name: string }>
        newDepts:    string[]
      }
      setNewDepts(autoDepts)

      const existingSet = new Set<string>(existingIds)
      const seenIds     = new Set<string>()

      const validated: ValidatedRow[] = mapped.map((row, i) => {
        const errors: string[]             = []
        let status: ValidatedRow["status"] = "create"
        let departmentId                   = ""

        // hcmId (required)
        const hcmId = row.hcmId.trim()
        if (!hcmId) {
          errors.push("HCM ID is required")
        } else if (seenIds.has(hcmId.toLowerCase())) {
          errors.push("Duplicate HCM ID in file")
        } else {
          seenIds.add(hcmId.toLowerCase())
          status = existingSet.has(hcmId) ? "update" : "create"
        }

        // name (required)
        if (!row.name.trim()) errors.push("Full Name is required")

        // department (required) — backend auto-creates unknown departments
        const dept = row.department.trim()
        if (!dept) {
          errors.push("Department is required")
        } else {
          const found = deptMap[dept.toLowerCase()] ?? deptMap[dept]
          if (found) {
            departmentId = found.id
          }
          // If still not found (e.g. numeric code that doesn't exist),
          // the backend will reject it — leave departmentId empty so the row errors
        }

        // CNIC format
        if (row.cnic.trim()) {
          const formatted = formatCnic(row.cnic)
          if (!/^\d{5}-\d{7}-\d{1}$/.test(formatted)) {
            errors.push("CNIC must be XXXXX-XXXXXXX-X")
          } else {
            row.cnic = formatted
          }
        }

        // Email format
        const emailTrimmed = row.email.trim()
        if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
          errors.push("Invalid email address")
        }
        row.email = emailTrimmed

        // Enum coercion — warn only (don't block import for unmappable enums)
        if (row.gender && !mapGender(row.gender)) {
          errors.push(`Gender "${row.gender}" not recognised (use Male/Female)`)
        }
        if (row.maritalStatus && !mapMaritalStatus(row.maritalStatus)) {
          errors.push(`Marital Status "${row.maritalStatus}" not recognised`)
        }
        if (row.bloodGroup && row.bloodGroup.trim() !== "-" && !mapBloodGroup(row.bloodGroup)) {
          errors.push(`Blood Group "${row.bloodGroup}" not recognised (use A+, B-, etc.)`)
        }
        if (row.division && !mapDivision(row.division)) {
          errors.push(`Division "${row.division}" not recognised`)
        }

        if (errors.length) status = "error"
        return { ...row, rowIndex: i + 2, status, errors, departmentId }
      })

      setValidatedRows(validated)
      setStep(3)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Validation failed."
      toast.error(msg)
    } finally {
      setChecking(false)
    }
  }

  // ── Submit import ──────────────────────────────────────────────────────────

  const submitImport = async () => {
    const toImport = validatedRows.filter((r) => r.status !== "error")
    if (!toImport.length) { toast.error("No valid rows to import."); return }

    setImporting(true)
    try {
      const rows = toImport.map((r) => ({
        hcmId:        r.hcmId.trim(),
        name:         r.name.trim(),
        departmentId: r.departmentId,
        _isNew:       r.status === "create",
        // Optional string fields
        ...(r.fatherName.trim()      ? { fatherName:       r.fatherName.trim()      } : {}),
        ...(r.designation.trim()     ? { designation:      r.designation.trim()     } : {}),
        ...(r.cnic.trim()            ? { cnic:             r.cnic.trim()            } : {}),
        ...(r.education.trim()       ? { education:        r.education.trim()       } : {}),
        ...(r.contactNumber.trim()   ? { contactNumber:    r.contactNumber.trim()   } : {}),
        ...(r.email.trim()           ? { email:            r.email.trim()           } : {}),
        ...(r.address.trim()         ? { address:          r.address.trim()         } : {}),
        ...(r.nokName.trim()         ? { nokName:          r.nokName.trim()         } : {}),
        ...(r.nokRelation.trim()     ? { nokRelation:      r.nokRelation.trim()     } : {}),
        ...(r.emergencyContact.trim()? { emergencyContact: r.emergencyContact.trim()} : {}),
        ...(r.grade.trim()           ? { grade:            r.grade.trim()           } : {}),
        ...(r.pgcGrade.trim()        ? { pgcGrade:         r.pgcGrade.trim()        } : {}),
        ...(r.project.trim()         ? { project:          r.project.trim()         } : {}),
        ...(r.subDepartment.trim() && r.subDepartment.trim() !== "0"
          ? { subDepartment: r.subDepartment.trim() } : {}),
        // Date fields
        ...(r.doj.trim()              ? { doj:              r.doj.trim()              } : {}),
        ...(r.confirmationDate.trim() ? { confirmationDate: r.confirmationDate.trim() } : {}),
        ...(r.dateOfBirth.trim()      ? { dateOfBirth:      r.dateOfBirth.trim()      } : {}),
        ...(r.cnicIssueDate.trim()    ? { cnicIssueDate:    r.cnicIssueDate.trim()    } : {}),
        ...(r.cnicExpiryDate.trim()   ? { cnicExpiryDate:   r.cnicExpiryDate.trim()   } : {}),
        // Enum fields (mapped to Prisma values)
        ...(mapGender(r.gender)         ? { gender:        mapGender(r.gender)        } : {}),
        ...(mapMaritalStatus(r.maritalStatus) ? { maritalStatus: mapMaritalStatus(r.maritalStatus) } : {}),
        ...(mapBloodGroup(r.bloodGroup) ? { bloodGroup:    mapBloodGroup(r.bloodGroup)} : {}),
        ...(mapReligion(r.religion)     ? { religion:      mapReligion(r.religion)    } : {}),
        ...(mapDivision(r.division)     ? { division:      mapDivision(r.division)    } : {}),
      }))

      const res  = await fetch("/api/employees/import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rows }),
      })
      const body = await res.json()
      if (!res.ok) { toast.error("Import failed."); return }

      setResult(body as ImportResult)
      setStep(4)
      onImported()
    } catch {
      toast.error("Import failed. Please try again.")
    } finally {
      setImporting(false)
    }
  }

  // ── Derived counts ─────────────────────────────────────────────────────────
  const createCount   = validatedRows.filter((r) => r.status === "create").length
  const updateCount   = validatedRows.filter((r) => r.status === "update").length
  const errorCount    = validatedRows.filter((r) => r.status === "error").length
  const hasErrors     = errorCount > 0

  const requiredMapped = SYSTEM_FIELDS
    .filter((f) => f.required)
    .every((f) => !!colMap[f.key])

  // Auto-detect coverage for the Step 2 info bar
  const totalMapped   = SYSTEM_FIELDS.filter((f) => !!colMap[f.key]).length
  const autoDetected  = SYSTEM_FIELDS.filter((f) => autoKeys.has(f.key)).length

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh]">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 gap-4">

          {/* Title */}
          <div className="shrink-0">
            <h2 className="text-base font-extrabold text-brand-purple">Import Employees</h2>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              {STEP_LABELS[step - 1]}
            </p>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            {STEP_LABELS.map((label, i) => {
              const s      = i + 1
              const done   = step > s
              const active = step === s
              return (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold transition-colors",
                    done   ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300" :
                    active ? "bg-brand-purple text-white" :
                             "bg-brand-bg text-muted-foreground ring-1 ring-border"
                  )}>
                    {done ? "✓" : s}
                  </div>
                  <span className={cn(
                    "text-[11px] font-bold hidden sm:block",
                    active ? "text-brand-purple" : "text-muted-foreground"
                  )}>
                    {label}
                  </span>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={cn("w-8 h-px mx-1", step > s ? "bg-emerald-300" : "bg-border")} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-brand-purple hover:bg-brand-bg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body (scrollable) ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="p-8 flex items-center justify-center min-h-[340px]">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "w-full max-w-md border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors select-none",
                  dragging
                    ? "border-brand-purple bg-brand-purple/5"
                    : "border-border hover:border-brand-purple/40 hover:bg-brand-bg/50"
                )}
              >
                <div className="w-14 h-14 rounded-2xl bg-brand-bg flex items-center justify-center mx-auto mb-4">
                  <FileSpreadsheet className="w-7 h-7 text-brand-purple/60" />
                </div>
                <p className="text-sm font-bold text-brand-purple mb-1">
                  {dragging ? "Drop your file here" : "Drag & drop your HCM export"}
                </p>
                <p className="text-xs text-muted-foreground mb-5 font-medium">
                  or click to browse — <span className="font-semibold">.xlsx only, max 10 MB</span>
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-white text-xs font-bold text-brand-purple hover:bg-brand-bg transition-colors shadow-sm">
                  <Upload className="w-3.5 h-3.5" />
                  Choose File
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Column Mapping ──────────────────────────────────────── */}
          {step === 2 && (
            <div className="p-6 space-y-4">

              {/* File info bar */}
              {file && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-emerald-800 truncate">{file.name}</p>
                    <p className="text-xs text-emerald-600 font-medium">
                      {formatBytes(file.size)} · {rawRows.length.toLocaleString()} data rows · {headers.length} columns detected
                    </p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                </div>
              )}

              {/* Auto-detect summary */}
              <div className="flex items-center gap-2.5 p-3 bg-brand-bg/60 rounded-xl border border-border">
                <Zap className="w-4 h-4 text-brand-purple shrink-0" />
                <p className="text-xs font-medium text-muted-foreground">
                  <span className="font-bold text-brand-purple">{autoDetected}</span> of {SYSTEM_FIELDS.length} columns were
                  auto-detected. <span className="font-bold text-brand-purple">{totalMapped}</span> mapped total.
                  Review and adjust any incorrect mappings below.
                </p>
              </div>

              <p className="text-xs text-muted-foreground font-medium -mt-1">
                The <span className="font-semibold text-slate-600">Expected HCM Header</span> column shows
                the exact column name from the Union Developers HCM export. Fields marked
                <span className="text-red-400 font-bold"> Required</span> must be mapped to proceed.
              </p>

              {/* Mapping table — grouped by section */}
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#f4f2fb] border-b border-border">
                      <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-[#49426E] w-[26%]">
                        System Field
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-[#49426E] w-[24%]">
                        Expected HCM Header
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-[#49426E]">
                        Your Excel Column
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {GROUPS.map((group) => {
                      const fields = SYSTEM_FIELDS.filter((f) => f.group === group)
                      return (
                        <>
                          {/* Group header row */}
                          <tr key={`grp-${group}`} className="bg-brand-bg/40 border-y border-border/70">
                            <td colSpan={3} className="px-4 py-2">
                              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#49426E]/70">
                                {group}
                              </span>
                            </td>
                          </tr>

                          {/* Field rows */}
                          {fields.map((field, i) => {
                            const isMapped   = !!colMap[field.key]
                            const isAuto     = isMapped && autoKeys.has(field.key)
                            const isManual   = isMapped && !autoKeys.has(field.key)
                            return (
                              <tr
                                key={field.key}
                                className={cn(
                                  "border-b border-border/50 last:border-0 transition-colors",
                                  i % 2 === 0 ? "bg-white" : "bg-brand-bg/10",
                                  isMapped && "hover:bg-emerald-50/30"
                                )}
                              >
                                {/* System field label */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={cn(
                                      "text-sm font-semibold",
                                      isMapped ? "text-brand-purple" : "text-slate-600"
                                    )}>
                                      {field.label}
                                    </span>
                                    {field.required && (
                                      <span className="text-[10px] font-bold text-red-400 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                        Required
                                      </span>
                                    )}
                                    {"hint" in field && (
                                      <span className="text-[10px] text-muted-foreground italic">
                                        {field.hint}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Expected HCM header */}
                                <td className="px-4 py-3">
                                  <code className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                                    {field.hcmHint}
                                  </code>
                                </td>

                                {/* Column dropdown */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={colMap[field.key] ?? ""}
                                      onChange={(e) => {
                                        const val = e.target.value
                                        setColMap((prev) => ({ ...prev, [field.key]: val || undefined }))
                                        // If user manually changes, remove from autoKeys
                                        if (autoKeys.has(field.key)) {
                                          setAutoKeys((prev) => {
                                            const next = new Set(prev)
                                            next.delete(field.key)
                                            return next
                                          })
                                        }
                                      }}
                                      className={cn(
                                        "flex-1 px-3 py-2 rounded-lg border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-colors",
                                        isMapped
                                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                          : field.required
                                          ? "border-red-200 bg-red-50 text-slate-500"
                                          : "border-border bg-white text-slate-500"
                                      )}
                                    >
                                      <option value="">— Skip this field —</option>
                                      {headers.map((h) => (
                                        <option key={h} value={h}>{h}</option>
                                      ))}
                                    </select>

                                    {/* Auto-detect badge */}
                                    {isAuto && (
                                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700 whitespace-nowrap">
                                        <Zap className="w-2.5 h-2.5" />
                                        Auto
                                      </span>
                                    )}
                                    {isManual && (
                                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-[10px] font-bold text-blue-600 whitespace-nowrap">
                                        Manual
                                      </span>
                                    )}
                                    {!isMapped && field.required && (
                                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Unmapped columns notice */}
              {(() => {
                const mappedHeaders = new Set(Object.values(colMap).filter(Boolean))
                const unmapped = headers.filter(
                  (h) => !mappedHeaders.has(h) && !SKIP_HEADERS.has(h.toLowerCase().trim())
                )
                if (!unmapped.length) return null
                return (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-800">
                        {unmapped.length} column{unmapped.length !== 1 ? "s" : ""} in your file will be ignored
                      </p>
                      <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                        {unmapped.map((h) => `"${h}"`).join(", ")}
                      </p>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── Step 3: Preview & Validation ───────────────────────────────── */}
          {step === 3 && (
            <div className="p-6 space-y-4">

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-extrabold text-emerald-700">{createCount}</p>
                  <p className="text-xs font-bold text-emerald-600 mt-0.5">To Create</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-extrabold text-blue-700">{updateCount}</p>
                  <p className="text-xs font-bold text-blue-600 mt-0.5">To Update</p>
                </div>
                <div className={cn(
                  "border rounded-xl p-4 text-center",
                  errorCount ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"
                )}>
                  <p className={cn("text-2xl font-extrabold", errorCount ? "text-red-600" : "text-slate-400")}>
                    {errorCount}
                  </p>
                  <p className={cn("text-xs font-bold mt-0.5", errorCount ? "text-red-500" : "text-slate-400")}>
                    Errors
                  </p>
                </div>
              </div>

              {newDepts.length > 0 && (
            <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-700">
                  {newDepts.length} new department{newDepts.length !== 1 ? "s" : ""} auto-created
                </p>
                <p className="text-xs text-emerald-600 font-medium mt-0.5">
                  {newDepts.join(", ")} — visible in Settings › Departments immediately.
                </p>
              </div>
            </div>
          )}
          {hasErrors && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-red-700">Errors must be fixed before importing</p>
                    <p className="text-xs text-red-600 font-medium mt-0.5">
                      Correct your spreadsheet, re-upload, and re-validate. Rows with errors will be skipped.
                    </p>
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Preview — first {Math.min(10, validatedRows.length)} of {validatedRows.length} rows
                </p>
                <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-xs min-w-[760px]">
                    <thead>
                      <tr className="bg-brand-bg/60 border-b border-border">
                        {["Row", "Status", "HCM ID", "Name", "Department", "Designation", "Issues"].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-[#49426E] whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {validatedRows.slice(0, 10).map((row) => (
                        <tr
                          key={row.rowIndex}
                          className={cn(
                            "border-b border-border last:border-0",
                            row.status === "error" ? "bg-red-50" : "hover:bg-brand-bg/20"
                          )}
                        >
                          <td className="px-3 py-2.5 text-muted-foreground font-medium">{row.rowIndex}</td>
                          <td className="px-3 py-2.5">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap",
                              row.status === "create" ? "bg-emerald-100 text-emerald-700" :
                              row.status === "update" ? "bg-blue-100 text-blue-700" :
                                                        "bg-red-100 text-red-600"
                            )}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono font-bold text-brand-purple whitespace-nowrap">
                            {row.hcmId || <span className="text-red-400 not-italic font-sans">missing</span>}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-700 max-w-[150px] truncate">
                            {row.name || <span className="text-red-400">missing</span>}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 max-w-[120px] truncate">
                            {row.department || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 max-w-[120px] truncate">
                            {row.designation || "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            {row.errors.length > 0 ? (
                              <ul className="space-y-0.5">
                                {row.errors.map((err, j) => (
                                  <li key={j} className="flex items-center gap-1 text-red-600 font-medium whitespace-nowrap">
                                    <AlertCircle className="w-3 h-3 shrink-0" />
                                    {err}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {validatedRows.length > 10 && (
                  <p className="text-[11px] text-muted-foreground font-medium mt-2 text-center">
                    {validatedRows.length - 10} more rows not shown
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Step 4: Result ──────────────────────────────────────────────── */}
          {step === 4 && result && (
            <div className="p-8 flex flex-col items-center justify-center min-h-[320px] text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-extrabold text-brand-purple mb-1">Import Complete</h3>
              <p className="text-sm text-muted-foreground font-medium mb-6">
                Your employee data has been imported successfully.
              </p>

              <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-6">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                  <p className="text-3xl font-extrabold text-emerald-700">{result.created}</p>
                  <p className="text-xs font-bold text-emerald-600 mt-1">Created</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                  <p className="text-3xl font-extrabold text-blue-700">{result.updated}</p>
                  <p className="text-xs font-bold text-blue-600 mt-1">Updated</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="w-full max-w-sm p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
                  <p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {result.errors.length} row{result.errors.length !== 1 ? "s" : ""} failed
                  </p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <li key={i} className="text-[11px] text-amber-700 flex items-start gap-1.5">
                        <span className="font-bold shrink-0">Row {e.row}:</span>
                        <span>{e.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">

          {/* Back */}
          <div>
            {step > 1 && step < 4 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                disabled={checking || importing}
                className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-brand-purple hover:bg-brand-bg transition-colors disabled:opacity-50"
              >
                Back
              </button>
            )}
          </div>

          {/* Primary action */}
          <div className="flex items-center gap-3">
            {step === 1 && (
              <p className="text-xs text-muted-foreground font-medium">
                Select a file to continue
              </p>
            )}

            {step === 2 && (
              <>
                {!requiredMapped && (
                  <p className="text-xs text-red-500 font-medium">
                    Map all required fields first
                  </p>
                )}
                <button
                  onClick={goToPreview}
                  disabled={checking || !requiredMapped}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-mid-purple text-white text-sm font-bold transition-colors shadow-md shadow-brand-purple/25 disabled:opacity-60"
                >
                  {checking
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ArrowRight className="w-4 h-4" />
                  }
                  {checking ? "Validating…" : "Validate & Preview"}
                </button>
              </>
            )}

            {step === 3 && (
              <>
                {hasErrors && (
                  <p className="text-xs text-red-500 font-medium">
                    {errorCount} row{errorCount !== 1 ? "s" : ""} will be skipped
                  </p>
                )}
                <button
                  onClick={submitImport}
                  disabled={importing || createCount + updateCount === 0}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-mid-purple text-white text-sm font-bold transition-colors shadow-md shadow-brand-purple/25 disabled:opacity-60"
                >
                  {importing
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <CheckCircle2 className="w-4 h-4" />
                  }
                  {importing
                    ? "Importing…"
                    : `Import ${createCount + updateCount} employee${createCount + updateCount !== 1 ? "s" : ""}`
                  }
                </button>
              </>
            )}

            {step === 4 && (
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-mid-purple text-white text-sm font-bold transition-colors shadow-md shadow-brand-purple/25"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
