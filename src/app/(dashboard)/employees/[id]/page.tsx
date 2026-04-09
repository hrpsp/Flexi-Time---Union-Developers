import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import Link from "next/link"
import {
  ChevronLeft, Pencil, Phone, Mail, MapPin,
  CreditCard, Calendar, Building2, BadgeCheck, Hash,
  Clock, ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { EmployeeStatusBadge } from "@/components/employees/employee-status-badge"

export const metadata = { title: "Employee — Flexi Time" }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(val: Date | string | null | undefined): string {
  if (!val) return "—"
  try { return format(new Date(val), "dd MMM yyyy") } catch { return "—" }
}

function InfoRow({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: string | null | undefined
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="w-7 h-7 rounded-lg bg-brand-bg flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-brand-mid-purple" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-brand-purple mt-0.5">{value || "—"}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params:       { id: string }
  searchParams: { tab?: string }
}) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasPermission(session.user.role, "employees:read")) redirect("/dashboard")

  const employee = await prisma.employee.findUnique({
    where:  { id: params.id },
    select: {
      id:               true,
      hcmId:            true,
      name:             true,
      fatherName:       true,
      designation:      true,
      status:           true,
      cnic:             true,
      gender:           true,
      dateOfBirth:      true,
      maritalStatus:    true,
      bloodGroup:       true,
      religion:         true,
      education:        true,
      contactNumber:    true,
      email:            true,
      address:          true,
      nokName:          true,
      nokRelation:      true,
      emergencyContact: true,
      grade:            true,
      pgcGrade:         true,
      division:         true,
      project:          true,
      subDepartment:    true,
      doj:              true,
      confirmationDate: true,
      cnicIssueDate:    true,
      cnicExpiryDate:   true,
      dol:              true,
      rejoiningDate:    true,
      createdAt:        true,
      department:    { select: { id: true, name: true, code: true } },
      statusHistory: {
        orderBy: { effectiveDate: "asc" },   // chronological for timeline
        select:  { id: true, status: true, effectiveDate: true, reason: true, createdAt: true },
      },
    },
  })

  if (!employee) notFound()

  const canEdit = hasPermission(session.user.role, "employees:edit")

  const activeTab = searchParams.tab === "history" ? "history" : "info"
  const tabBase   = `/employees/${employee.id}`

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">

      {/* ── Breadcrumb + actions ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link
            href="/employees"
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-brand-purple transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Employees
          </Link>
          <span className="text-muted-foreground/40 text-xs">/</span>
          <span className="text-xs font-semibold text-brand-purple truncate max-w-[200px]">
            {employee.name}
          </span>
        </div>
        {canEdit && employee.status === "ACTIVE" && (
          <Link
            href={`/employees/${employee.id}/edit`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-purple hover:bg-brand-mid-purple text-white text-xs font-bold transition-colors shadow-sm shadow-brand-purple/20"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </Link>
        )}
      </div>

      {/* ── Hero card ────────────────────────────────────────────────── */}
      <div className={cn(
        "rounded-2xl border p-6 flex items-center gap-5",
        employee.status === "INACTIVE"
          ? "bg-slate-50 border-slate-200"
          : "bg-white border-border"
      )}>
        {/* Avatar */}
        <div className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0",
          employee.status === "INACTIVE" ? "bg-slate-200" : "bg-brand-purple/10"
        )}>
          <span className={cn(
            "text-2xl font-extrabold select-none",
            employee.status === "INACTIVE" ? "text-slate-400" : "text-brand-purple"
          )}>
            {employee.name.charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className={cn(
              "text-xl font-extrabold",
              employee.status === "INACTIVE" ? "text-slate-500" : "text-brand-purple"
            )}>
              {employee.name}
            </h1>
            <EmployeeStatusBadge status={employee.status} />
          </div>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            {employee.designation && (
              <p className="text-sm text-muted-foreground font-medium">{employee.designation}</p>
            )}
            {employee.department && (
              <p className="text-sm text-muted-foreground font-medium">
                <span className="text-[10px] font-bold bg-brand-bg rounded px-1.5 py-0.5 text-brand-mid-purple mr-1">
                  {employee.department.code}
                </span>
                {employee.department.name}
              </p>
            )}
            {employee.status === "INACTIVE" && employee.dol && (
              <p className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Left {fmt(employee.dol)}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right hidden sm:block">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">HCM ID</p>
          <span className={cn(
            "font-mono text-sm font-extrabold px-3 py-1 rounded-lg",
            employee.status === "INACTIVE"
              ? "text-slate-400 bg-slate-100"
              : "text-brand-purple bg-brand-bg"
          )}>
            {employee.hcmId}
          </span>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-brand-bg rounded-xl p-1 w-fit border border-border">
        {[
          { key: "info",    label: "Employee Info",    href: tabBase },
          { key: "history", label: "Status History",   href: `${tabBase}?tab=history` },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold transition-colors",
              activeTab === t.key
                ? "bg-white text-brand-purple shadow-sm"
                : "text-muted-foreground hover:text-brand-purple"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* INFO TAB                                                       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "info" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left col ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Personal */}
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-6 py-3.5 border-b border-border bg-brand-bg/60">
                <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-brand-mid-purple">
                  Personal Information
                </h3>
              </div>
              <div className="px-6 divide-y divide-border">
                <InfoRow icon={Hash}       label="Father Name"     value={employee.fatherName} />
                <InfoRow icon={CreditCard} label="CNIC"            value={employee.cnic} />
                <InfoRow icon={Calendar}   label="Date of Birth"   value={fmt(employee.dateOfBirth)} />
                <InfoRow icon={Hash}       label="Gender"          value={employee.gender ?? null} />
                <InfoRow icon={Hash}       label="Marital Status"  value={employee.maritalStatus ?? null} />
                <InfoRow icon={Hash}       label="Blood Group"     value={employee.bloodGroup ?? null} />
                <InfoRow icon={Hash}       label="Religion"        value={employee.religion ?? null} />
                <InfoRow icon={Hash}       label="Education"       value={employee.education ?? null} />
                <InfoRow icon={Phone}      label="Contact Number"  value={employee.contactNumber ?? null} />
                <InfoRow icon={Mail}       label="Email"           value={employee.email} />
                <InfoRow icon={MapPin}     label="Address"         value={employee.address} />
              </div>
            </div>

            {/* Employment */}
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-6 py-3.5 border-b border-border bg-brand-bg/60">
                <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-brand-mid-purple">
                  Employment Details
                </h3>
              </div>
              <div className="px-6 divide-y divide-border">
                <InfoRow icon={BadgeCheck} label="HCM ID"             value={employee.hcmId} />
                <InfoRow icon={Building2}  label="Department"          value={employee.department?.name} />
                <InfoRow icon={Hash}       label="Grade"               value={employee.grade ?? null} />
                <InfoRow icon={Hash}       label="PGC Grade"           value={employee.pgcGrade ?? null} />
                <InfoRow icon={Hash}       label="Division"            value={employee.division ?? null} />
                <InfoRow icon={Hash}       label="Project"             value={employee.project ?? null} />
                <InfoRow icon={Hash}       label="Sub-Department"      value={employee.subDepartment ?? null} />
                <InfoRow icon={Calendar}   label="Date of Joining"     value={fmt(employee.doj)} />
                <InfoRow icon={Calendar}   label="Confirmation Date"   value={fmt(employee.confirmationDate)} />
                <InfoRow icon={CreditCard} label="CNIC Issue Date"     value={fmt(employee.cnicIssueDate)} />
                <InfoRow icon={CreditCard} label="CNIC Expiry Date"    value={fmt(employee.cnicExpiryDate)} />
                {employee.rejoiningDate && (
                  <InfoRow icon={Calendar} label="Date of Rejoining"  value={fmt(employee.rejoiningDate)} />
                )}
                {employee.dol && (
                  <InfoRow icon={Calendar} label="Date of Leaving"    value={fmt(employee.dol)} />
                )}
                <InfoRow icon={Clock}      label="Record Created"      value={fmt(employee.createdAt)} />
              </div>
            </div>

            {/* Emergency / NOK */}
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-6 py-3.5 border-b border-border bg-brand-bg/60">
                <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-brand-mid-purple">
                  Emergency / Next of Kin
                </h3>
              </div>
              <div className="px-6 divide-y divide-border">
                <InfoRow icon={Hash}  label="NOK Name"          value={employee.nokName ?? null} />
                <InfoRow icon={Hash}  label="NOK Relation"      value={employee.nokRelation ?? null} />
                <InfoRow icon={Phone} label="Emergency Contact"  value={employee.emergencyContact ?? null} />
              </div>
            </div>
          </div>

          {/* Right col — quick status snapshot ─────────────────────── */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-border overflow-hidden sticky top-6">
              <div className="px-5 py-3.5 border-b border-border bg-brand-bg/60 flex items-center justify-between">
                <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-brand-mid-purple">
                  Status Snapshot
                </h3>
                <Link
                  href={`${tabBase}?tab=history`}
                  className="text-[11px] font-bold text-brand-purple hover:underline flex items-center gap-0.5"
                >
                  Full history <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-5">
                {employee.statusHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No history yet.</p>
                ) : (
                  /* Show last 5 entries, newest first (reverse the asc list) */
                  <ol className="relative border-l border-border space-y-5 ml-2">
                    {[...employee.statusHistory].reverse().slice(0, 5).map((h) => (
                      <li key={h.id} className="ml-4">
                        <span className={cn(
                          "absolute -left-1.5 mt-1 w-3 h-3 rounded-full border-2 border-white",
                          h.status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-400"
                        )} />
                        <p className={cn(
                          "text-xs font-bold",
                          h.status === "ACTIVE" ? "text-emerald-700" : "text-slate-500"
                        )}>
                          {h.status === "ACTIVE" ? "Activated" : "Deactivated"}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                          {fmt(h.effectiveDate)}
                        </p>
                        {h.reason && (
                          <p className="text-[11px] text-slate-500 italic mt-0.5 leading-snug">
                            "{h.reason}"
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* STATUS HISTORY TAB                                             */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "history" && (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-brand-bg/60">
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-brand-mid-purple">
              Full Status History
            </h3>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Chronological record of all status changes for {employee.name}.
              Attendance data is always preserved regardless of status.
            </p>
          </div>

          <div className="p-6">
            {employee.statusHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Clock className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm font-bold text-muted-foreground">No status history yet.</p>
              </div>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />

                <ol className="space-y-0">
                  {(employee.statusHistory as { id: string; status: string; effectiveDate: Date; reason: string | null; createdAt: Date }[]).map((h, i) => {
                    const isActive  = h.status === "ACTIVE"
                    const isFirst   = i === 0
                    const isLast    = i === employee.statusHistory.length - 1
                    const isJoin    = isFirst && isActive
                    const isRejoin  = !isFirst && isActive

                    return (
                      <li key={h.id} className="relative flex gap-6 pb-8 last:pb-0">
                        {/* Dot */}
                        <div className="relative z-10 flex-shrink-0 mt-1">
                          <div className={cn(
                            "w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center",
                            isActive ? "bg-emerald-500" : "bg-slate-400"
                          )}>
                            {isActive
                              ? <span className="text-white text-[10px] font-extrabold">✓</span>
                              : <span className="text-white text-[10px] font-extrabold">✕</span>
                            }
                          </div>
                        </div>

                        {/* Content */}
                        <div className={cn(
                          "flex-1 rounded-xl border p-4",
                          isActive
                            ? "bg-emerald-50/60 border-emerald-200"
                            : "bg-slate-50 border-slate-200",
                          isLast && "ring-2 ring-offset-1 ring-brand-purple/10"
                        )}>
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn(
                                  "text-sm font-extrabold",
                                  isActive ? "text-emerald-700" : "text-slate-600"
                                )}>
                                  {isJoin   ? "Joined"      :
                                   isRejoin ? "Rejoined"    :
                                              "Deactivated"}
                                </span>
                                {isLast && (
                                  <span className="text-[10px] font-bold bg-brand-purple text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                    Current
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                                Effective {fmt(h.effectiveDate)}
                              </p>
                            </div>

                            <span className={cn(
                              "text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0",
                              isActive
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            )}>
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </div>

                          {h.reason && (
                            <p className="text-xs text-slate-500 italic mt-2 border-t border-current/10 pt-2">
                              "{h.reason}"
                            </p>
                          )}

                          <p className="text-[10px] text-muted-foreground mt-2 font-medium">
                            Recorded {fmt(h.createdAt)}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
