"use client"

import { useEffect, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, AlertCircle, ChevronLeft, Save } from "lucide-react"
import { createEmployeeSchema, type CreateEmployeeInput } from "@/lib/validations/employees"
import { SearchableDeptSelect, type DeptOption } from "./searchable-dept-select"
import { CnicInput } from "./cnic-input"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-border bg-brand-bg " +
  "text-sm font-medium text-brand-purple placeholder-slate-400 " +
  "focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple " +
  "transition-colors disabled:opacity-50"

const errorInputCls = "border-red-400"

const selectCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-border bg-brand-bg " +
  "text-sm font-medium text-brand-purple " +
  "focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple " +
  "transition-colors appearance-none cursor-pointer"

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-500 font-medium">
      <AlertCircle className="w-3 h-3 shrink-0" />{message}
    </p>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="px-6 py-3.5 border-b border-border bg-brand-bg/60">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-brand-mid-purple">
          {title}
        </h3>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
        {children}
      </div>
    </div>
  )
}

function FullWidth({ children }: { children: React.ReactNode }) {
  return <div className="md:col-span-2 lg:col-span-3">{children}</div>
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface EmployeeFormProps {
  mode:          "create" | "edit"
  employeeId?:   string
  defaultValues?: Partial<CreateEmployeeInput>
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function EmployeeForm({ mode, employeeId, defaultValues }: EmployeeFormProps) {
  const router = useRouter()
  const [departments, setDepartments] = useState<DeptOption[]>([])
  const [deptLoading, setDeptLoading] = useState(true)
  const [saving, setSaving]           = useState(false)

  // ── Load departments ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((b) => setDepartments(b.departments ?? []))
      .catch(() => toast.error("Failed to load departments."))
      .finally(() => setDeptLoading(false))
  }, [])

  // ── Form ────────────────────────────────────────────────────────────────────
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      hcmId:            "",
      cnic:             "",
      name:             "",
      fatherName:       "",
      gender:           undefined,
      dateOfBirth:      "",
      maritalStatus:    undefined,
      bloodGroup:       undefined,
      religion:         undefined,
      education:        "",
      contactNumber:    "",
      email:            "",
      address:          "",
      nokName:          "",
      nokRelation:      "",
      emergencyContact: "",
      designation:      "",
      grade:            "",
      pgcGrade:         "",
      departmentId:     "",
      subDepartment:    "",
      division:         undefined,
      project:          "",
      doj:              "",
      confirmationDate: "",
      cnicIssueDate:    "",
      cnicExpiryDate:   "",
      ...defaultValues,
    },
  })

  // ── Submit ───────────────────────────────────────────────────────────────────
  const onSubmit = async (data: CreateEmployeeInput) => {
    setSaving(true)
    try {
      const url    = mode === "create" ? "/api/employees" : `/api/employees/${employeeId}`
      const method = mode === "create" ? "POST" : "PATCH"

      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      })
      const body = await res.json()

      if (!res.ok) {
        const msg =
          typeof body.error === "string"
            ? body.error
            : body.error?.formErrors?.[0] ?? "Something went wrong."
        toast.error(msg)
        return
      }

      toast.success(
        mode === "create"
          ? `Employee "${body.employee.name}" created.`
          : `Employee "${body.employee.name}" updated.`
      )
      router.push(`/employees/${body.employee.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

      {/* ── SECTION 1: Identification ──────────────────────────────────────── */}
      <Section title="Identification">

        {/* HCM ID */}
        <div>
          <FieldLabel required>HCM ID</FieldLabel>
          <input
            type="text"
            placeholder="e.g. 200201"
            {...register("hcmId")}
            disabled={mode === "edit"}
            className={cn(inputCls, errors.hcmId && errorInputCls, mode === "edit" && "opacity-60 cursor-not-allowed")}
          />
          <FieldError message={errors.hcmId?.message} />
          {mode === "edit" && (
            <p className="mt-1 text-[11px] text-muted-foreground">HCM ID cannot be changed after creation.</p>
          )}
        </div>

        {/* CNIC */}
        <div>
          <FieldLabel>CNIC</FieldLabel>
          <Controller
            name="cnic"
            control={control}
            render={({ field }) => (
              <CnicInput
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.cnic?.message}
              />
            )}
          />
          <FieldError message={errors.cnic?.message} />
        </div>

        {/* CNIC Issue Date */}
        <div>
          <FieldLabel>CNIC Issue Date</FieldLabel>
          <input type="date" {...register("cnicIssueDate")} className={inputCls} />
        </div>

        {/* CNIC Expiry Date */}
        <div>
          <FieldLabel>CNIC Expiry Date</FieldLabel>
          <input type="date" {...register("cnicExpiryDate")} className={inputCls} />
        </div>
      </Section>

      {/* ── SECTION 2: Personal Information ───────────────────────────────── */}
      <Section title="Personal Information">

        {/* Full Name */}
        <div>
          <FieldLabel required>Full Name</FieldLabel>
          <input
            type="text"
            placeholder="Muhammad Ali"
            {...register("name")}
            className={cn(inputCls, errors.name && errorInputCls)}
          />
          <FieldError message={errors.name?.message} />
        </div>

        {/* Father Name */}
        <div>
          <FieldLabel>Father Name</FieldLabel>
          <input
            type="text"
            placeholder="Abdullah"
            {...register("fatherName")}
            className={inputCls}
          />
        </div>

        {/* Gender */}
        <div>
          <FieldLabel>Gender</FieldLabel>
          <select {...register("gender")} className={selectCls}>
            <option value="">— Select —</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </div>

        {/* Date of Birth */}
        <div>
          <FieldLabel>Date of Birth</FieldLabel>
          <input type="date" {...register("dateOfBirth")} className={inputCls} />
        </div>

        {/* Marital Status */}
        <div>
          <FieldLabel>Marital Status</FieldLabel>
          <select {...register("maritalStatus")} className={selectCls}>
            <option value="">— Select —</option>
            <option value="MARRIED">Married</option>
            <option value="UN_MARRIED">Unmarried</option>
          </select>
        </div>

        {/* Blood Group */}
        <div>
          <FieldLabel>Blood Group</FieldLabel>
          <select {...register("bloodGroup")} className={selectCls}>
            <option value="">— Select —</option>
            {["A_POS","A_NEG","B_POS","B_NEG","O_POS","O_NEG","AB_POS","AB_NEG"].map((g) => (
              <option key={g} value={g}>{g.replace("_POS", "+").replace("_NEG", "-").replace("_", "")}</option>
            ))}
          </select>
        </div>

        {/* Religion */}
        <div>
          <FieldLabel>Religion</FieldLabel>
          <select {...register("religion")} className={selectCls}>
            <option value="">— Select —</option>
            <option value="ISLAM">Islam</option>
            <option value="CHRISTIAN">Christian</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {/* Education */}
        <div>
          <FieldLabel>Education</FieldLabel>
          <input
            type="text"
            placeholder="e.g. MBA, B.Sc Engineering"
            {...register("education")}
            className={inputCls}
          />
        </div>

        {/* Contact Number */}
        <div>
          <FieldLabel>Contact Number</FieldLabel>
          <input
            type="tel"
            placeholder="03XX-XXXXXXX"
            {...register("contactNumber")}
            className={inputCls}
          />
        </div>

        {/* Email */}
        <div>
          <FieldLabel>Email</FieldLabel>
          <input
            type="email"
            placeholder="employee@company.com"
            {...register("email")}
            className={cn(inputCls, errors.email && errorInputCls)}
          />
          <FieldError message={errors.email?.message} />
        </div>

        {/* Address — full width */}
        <FullWidth>
          <FieldLabel>Address</FieldLabel>
          <textarea
            rows={2}
            placeholder="Full residential address"
            {...register("address")}
            className={cn(inputCls, "resize-none")}
          />
        </FullWidth>
      </Section>

      {/* ── SECTION 3: Emergency / Next of Kin ────────────────────────────── */}
      <Section title="Emergency / Next of Kin">

        {/* NOK Name */}
        <div>
          <FieldLabel>NOK Name</FieldLabel>
          <input
            type="text"
            placeholder="Emergency contact name"
            {...register("nokName")}
            className={inputCls}
          />
        </div>

        {/* NOK Relation */}
        <div>
          <FieldLabel>NOK Relation</FieldLabel>
          <input
            type="text"
            placeholder="e.g. Father, Spouse, Brother"
            {...register("nokRelation")}
            className={inputCls}
          />
        </div>

        {/* Emergency Contact */}
        <div>
          <FieldLabel>Emergency Contact</FieldLabel>
          <input
            type="tel"
            placeholder="03XX-XXXXXXX"
            {...register("emergencyContact")}
            className={inputCls}
          />
        </div>
      </Section>

      {/* ── SECTION 4: Employment Details ─────────────────────────────────── */}
      <Section title="Employment Details">

        {/* Department */}
        <div>
          <FieldLabel required>Department</FieldLabel>
          <Controller
            name="departmentId"
            control={control}
            render={({ field }) => (
              <SearchableDeptSelect
                options={departments}
                value={field.value ?? ""}
                onChange={field.onChange}
                loading={deptLoading}
                error={errors.departmentId?.message}
              />
            )}
          />
          <FieldError message={errors.departmentId?.message} />
        </div>

        {/* Sub-Department */}
        <div>
          <FieldLabel>Sub-Department</FieldLabel>
          <input
            type="text"
            placeholder="e.g. Finance, IT"
            {...register("subDepartment")}
            className={inputCls}
          />
        </div>

        {/* Division */}
        <div>
          <FieldLabel>Division</FieldLabel>
          <select {...register("division")} className={selectCls}>
            <option value="">— Select —</option>
            <option value="SUPPORT_SERVICES">Support Services</option>
            <option value="INFRASTRUCTURE">Infrastructure</option>
            <option value="CONSTRUCTION">Construction</option>
            <option value="COMMERCIAL">Commercial</option>
          </select>
        </div>

        {/* Designation */}
        <div>
          <FieldLabel>Designation</FieldLabel>
          <input
            type="text"
            placeholder="e.g. Senior Executive"
            {...register("designation")}
            className={inputCls}
          />
        </div>

        {/* Grade */}
        <div>
          <FieldLabel>Grade</FieldLabel>
          <input
            type="text"
            placeholder="e.g. G-8, M-3"
            {...register("grade")}
            className={inputCls}
          />
        </div>

        {/* PGC Grade */}
        <div>
          <FieldLabel>PGC Grade</FieldLabel>
          <input
            type="text"
            placeholder="PGC / payroll grade"
            {...register("pgcGrade")}
            className={inputCls}
          />
        </div>

        {/* Project */}
        <div>
          <FieldLabel>Project</FieldLabel>
          <input
            type="text"
            placeholder="e.g. Phase IV, Block C"
            {...register("project")}
            className={inputCls}
          />
        </div>

        {/* Date of Joining */}
        <div>
          <FieldLabel>Date of Joining</FieldLabel>
          <input type="date" {...register("doj")} className={inputCls} />
        </div>

        {/* Confirmation Date */}
        <div>
          <FieldLabel>Confirmation Date</FieldLabel>
          <input type="date" {...register("confirmationDate")} className={inputCls} />
        </div>
      </Section>

      {/* ── Action bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-brand-purple hover:bg-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-mid-purple text-white text-sm font-bold transition-colors shadow-md shadow-brand-purple/25 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : mode === "create" ? "Create Employee" : "Save Changes"}
        </button>
      </div>
    </form>
  )
}
