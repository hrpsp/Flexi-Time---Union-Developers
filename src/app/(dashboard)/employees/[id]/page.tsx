import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import Link from "next/link"
import {
  ChevronLeft, Pencil, Phone, Mail, MapPin, CreditCard,
  Calendar, Building2, BadgeCheck, Hash, Clock, Activity,
  User, FileText, TrendingUp, CheckCircle2, XCircle, AlertCircle,
  Minus,
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

function InfoItem({
  icon: Icon, label, value, mono = false,
}: { icon: React.ElementType; label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </span>
      <span className={cn("text-xs font-semibold text-[#322E53]", mono && "font-mono")}>
        {value || "—"}
      </span>
    </div>
  )
}

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  PRESENT:     { bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle2,  label: "P"  },
  SHORT_TIME:  { bg: "bg-amber-100",   text: "text-amber-700",   icon: AlertCircle,   label: "ST" },
  HALF_DAY:    { bg: "bg-orange-100",  text: "text-orange-700",  icon: AlertCircle,   label: "H"  },
  ABSENT:      { bg: "bg-red-100",     text: "text-red-700",     icon: XCircle,       label: "A"  },
  LEAVE:       { bg: "bg-blue-100",    text: "text-blue-700",    icon: Calendar,      label: "L"  },
  MISSING_IN:  { bg: "bg-violet-100",  text: "text-violet-700",  icon: AlertCircle,   label: "MI" },
  MISSING_OUT: { bg: "bg-fuchsia-100", text: "text-fuchsia-700", icon: AlertCircle,   label: "MO" },
  UNMARKED:    { bg: "bg-slate-100",   text: "text-slate-500",   icon: Minus,         label: "?"  },
  OFF:         { bg: "bg-slate-200",   text: "text-slate-400",   icon: Minus,         label: "·"  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { tab?: string }
}) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasPermission(session.user.role, "employees:read")) redirect("/dashboard")

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    select: {
      id: true, hcmId: true, name: true, fatherName: true,
      designation: true, status: true, cnic: true, gender: true,
      dateOfBirth: true, maritalStatus: true, bloodGroup: true,
      religion: true, education: true, contactNumber: true,
      email: true, address: true, nokName: true, nokRelation: true,
      emergencyContact: true, grade: true, pgcGrade: true, division: true,
      project: true, subDepartment: true, doj: true, confirmationDate: true,
      cnicIssueDate: true, cnicExpiryDate: true, dol: true, rejoiningDate: true,
      createdAt: true,
      department: { select: { id: true, name: true, code: true } },
      statusHistory: {
        orderBy: { effectiveDate: "desc" },
        select: { id: true, status: true, effectiveDate: true, reason: true, createdAt: true },
      },
    },
  })
  if (!employee) notFound()

  // ── Attendance summary for active period ──────────────────────────────────
  const activePeriod = await prisma.attendancePeriod.findFirst({
    where: { isActive: true },
    select: { id: true, label: true, startDate: true, endDate: true },
  })

  let attendanceSummary: {
    records: Array<{ date: string; effectiveStatus: string; inTime: string | null; outTime: string | null; workedMinutes: number | null }>
    stats: Record<string, number>
  } | null = null

  if (activePeriod) {
    const records = await prisma.attendanceRecord.findMany({
      where: { employeeId: employee.id, periodId: activePeriod.id },
      select: { date: true, calculatedStatus: true, overriddenStatus: true, inTime: true, outTime: true, workedMinutes: true },
      orderBy: { date: "desc" },
      take: 30,
    })

    const stats: Record<string, number> = {}
    const mapped = records.map((r) => {
      const eff = r.overriddenStatus ?? r.calculatedStatus
      stats[eff] = (stats[eff] ?? 0) + 1
      return {
        date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
        effectiveStatus: eff,
        inTime: r.inTime,
        outTime: r.outTime,
        workedMinutes: r.workedMinutes,
      }
    })

    attendanceSummary = { records: mapped, stats }
  }

  const canEdit = hasPermission(session.user.role, "employees:edit")

  const tabs = [
    { key: "overview",    label: "Overview",    icon: User },
    { key: "personal",    label: "Personal",    icon: FileText },
    { key: "employment",  label: "Employment",  icon: Building2 },
    { key: "attendance",  label: "Attendance",  icon: Activity },
    { key: "history",     label: "Status History", icon: TrendingUp },
  ]
  const activeTab = tabs.find(t => t.key === searchParams.tab)?.key ?? "overview"
  const tabBase = `/employees/${employee.id}`

  const initials = employee.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const isActive = employee.status === "ACTIVE"

  return (
    <div className="flex flex-col h-full -m-6">

      {/* ── Top Header Bar ────────────────────────────────────────────────── */}
      <div className={cn(
        "px-6 pt-5 pb-0 border-b border-border shrink-0",
        isActive ? "bg-white" : "bg-slate-50"
      )}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/employees"
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-[#322E53] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Employees
          </Link>
          <span className="text-muted-foreground/40 text-xs">/</span>
          <span className="text-xs font-semibold text-[#322E53] truncate max-w-[200px]">{employee.name}</span>
        </div>

        {/* Profile Hero Row */}
        <div className="flex items-center gap-5 mb-4">
          {/* Avatar */}
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-xl font-extrabold select-none",
            isActive ? "bg-[#322E53]/10 text-[#322E53]" : "bg-slate-200 text-slate-400"
          )}>
            {initials}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className={cn("text-lg font-extrabold leading-tight", isActive ? "text-[#322E53]" : "text-slate-500")}>
                {employee.name}
              </h1>
              <EmployeeStatusBadge status={employee.status} />
              {employee.hcmId && (
                <span className={cn(
                  "font-mono text-[11px] font-extrabold px-2 py-0.5 rounded-lg",
                  isActive ? "bg-[#F5F4F8] text-[#322E53]" : "bg-slate-100 text-slate-400"
                )}>
                  {employee.hcmId}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 flex-wrap text-xs text-muted-foreground font-medium">
              {employee.designation && <span>{employee.designation}</span>}
              {employee.department && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  <span className="text-[9px] font-bold bg-[#322E53]/10 text-[#322E53] px-1 py-0.5 rounded mr-0.5">
                    {employee.department.code}
                  </span>
                  {employee.department.name}
                </span>
              )}
              {employee.doj && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Joined {fmt(employee.doj)}</span>}
            </div>
          </div>

          {/* Edit button */}
          {canEdit && isActive && (
            <Link
              href={`/employees/${employee.id}/edit`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#322E53] hover:bg-[#49426E] text-white text-xs font-bold transition-colors shadow-sm shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Link>
          )}
        </div>

        {/* Tab Bar */}
        <div className="flex items-end gap-0">
          {tabs.map((t) => {
            const Icon = t.icon
            const isCurrentTab = activeTab === t.key
            return (
              <Link
                key={t.key}
                href={t.key === "overview" ? tabBase : `${tabBase}?tab=${t.key}`}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap",
                  isCurrentTab
                    ? "border-[#322E53] text-[#322E53]"
                    : "border-transparent text-muted-foreground hover:text-[#322E53] hover:border-[#322E53]/30"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6 bg-[#F5F4F8]/40">

        {/* ════════════ OVERVIEW TAB ════════════ */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-6xl">
            {/* Left: Quick Info Cards */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              {/* Contact Card */}
              <div className="bg-white rounded-2xl border border-border p-5">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#49426E] mb-4">Contact</h3>
                <div className="space-y-3.5">
                  <InfoItem icon={Phone} label="Phone" value={employee.contactNumber} />
                  <InfoItem icon={Mail} label="Email" value={employee.email} />
                  <InfoItem icon={MapPin} label="Address" value={employee.address} />
                </div>
              </div>

              {/* Identity Card */}
              <div className="bg-white rounded-2xl border border-border p-5">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#49426E] mb-4">Identity</h3>
                <div className="space-y-3.5">
                  <InfoItem icon={CreditCard} label="CNIC" value={employee.cnic} mono />
                  <InfoItem icon={Calendar} label="Date of Birth" value={fmt(employee.dateOfBirth)} />
                  <InfoItem icon={Hash} label="Blood Group" value={employee.bloodGroup} />
                  <InfoItem icon={Hash} label="Gender" value={employee.gender} />
                </div>
              </div>

              {/* Work Card */}
              <div className="bg-white rounded-2xl border border-border p-5">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#49426E] mb-4">Work</h3>
                <div className="space-y-3.5">
                  <InfoItem icon={BadgeCheck} label="Designation" value={employee.designation} />
                  <InfoItem icon={Building2} label="Department" value={employee.department?.name} />
                  <InfoItem icon={Hash} label="Grade" value={employee.grade} />
                  <InfoItem icon={Hash} label="Division" value={employee.division} />
                </div>
              </div>

              {/* Dates Card */}
              <div className="bg-white rounded-2xl border border-border p-5">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#49426E] mb-4">Key Dates</h3>
                <div className="space-y-3.5">
                  <InfoItem icon={Calendar} label="Date of Joining" value={fmt(employee.doj)} />
                  <InfoItem icon={Calendar} label="Confirmation" value={fmt(employee.confirmationDate)} />
                  {employee.dol && <InfoItem icon={Calendar} label="Date of Leaving" value={fmt(employee.dol)} />}
                  {employee.rejoiningDate && <InfoItem icon={Calendar} label="Rejoining" value={fmt(employee.rejoiningDate)} />}
                </div>
              </div>
            </div>

            {/* Right: Attendance Widget */}
            <div className="space-y-4">
              {attendanceSummary && activePeriod ? (
                <>
                  <div className="bg-white rounded-2xl border border-border p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#49426E]">
                          Current Period
                        </h3>
                        <p className="text-sm font-extrabold text-[#322E53] mt-0.5">{activePeriod.label}</p>
                      </div>
                      <Link
                        href={`?tab=attendance`}
                        className="text-[10px] font-bold text-[#322E53] hover:underline"
                      >
                        Full view →
                      </Link>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-4 gap-1.5 mb-4">
                      {["PRESENT", "ABSENT", "LEAVE", "MISSING_IN"].map((key) => {
                        const s = STATUS_STYLE[key]
                        const count = attendanceSummary!.stats[key] ?? 0
                        return (
                          <div key={key} className={cn("rounded-xl p-2 text-center", s.bg)}>
                            <p className={cn("text-lg font-extrabold leading-none", s.text)}>{count}</p>
                            <p className={cn("text-[8px] font-bold mt-0.5", s.text)}>{s.label}</p>
                          </div>
                        )
                      })}
                    </div>

                    {/* Recent records mini-list */}
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Recent</p>
                      {attendanceSummary.records.slice(0, 7).map((r) => {
                        const s = STATUS_STYLE[r.effectiveStatus] ?? STATUS_STYLE.UNMARKED
                        const Icon = s.icon
                        return (
                          <div key={r.date} className="flex items-center gap-2">
                            <span className={cn("w-6 h-5 rounded flex items-center justify-center text-[9px] font-extrabold shrink-0", s.bg, s.text)}>
                              {s.label}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium flex-1">
                              {new Date(r.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                            {r.inTime && r.outTime && (
                              <span className="text-[9px] font-mono text-[#322E53] font-semibold">
                                {r.inTime} – {r.outTime}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-2xl border border-border p-5 flex flex-col items-center justify-center text-center py-10">
                  <Activity className="w-8 h-8 text-[#EEC293] mb-2" />
                  <p className="text-xs font-semibold text-muted-foreground">No active period</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════ PERSONAL TAB ════════════ */}
        {activeTab === "personal" && (
          <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border bg-[#F5F4F8]/60">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#49426E]">Personal Information</h3>
              </div>
              <div className="p-5 grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoItem icon={Hash} label="Father Name" value={employee.fatherName} />
                <InfoItem icon={CreditCard} label="CNIC" value={employee.cnic} mono />
                <InfoItem icon={Calendar} label="Date of Birth" value={fmt(employee.dateOfBirth)} />
                <InfoItem icon={Hash} label="Gender" value={employee.gender} />
                <InfoItem icon={Hash} label="Marital Status" value={employee.maritalStatus} />
                <InfoItem icon={Hash} label="Blood Group" value={employee.bloodGroup} />
                <InfoItem icon={Hash} label="Religion" value={employee.religion} />
                <InfoItem icon={Hash} label="Education" value={employee.education} />
              </div>
            </div>

            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-border overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border bg-[#F5F4F8]/60">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#49426E]">Contact Details</h3>
                </div>
                <div className="p-5 grid grid-cols-1 gap-4">
                  <InfoItem icon={Phone} label="Phone" value={employee.contactNumber} />
                  <InfoItem icon={Mail} label="Email" value={employee.email} />
                  <InfoItem icon={MapPin} label="Address" value={employee.address} />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-border overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border bg-[#F5F4F8]/60">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#49426E]">Next of Kin</h3>
                </div>
                <div className="p-5 grid grid-cols-1 gap-4">
                  <InfoItem icon={Hash} label="NOK Name" value={employee.nokName} />
                  <InfoItem icon={Hash} label="Relation" value={employee.nokRelation} />
                  <InfoItem icon={Phone} label="Emergency Contact" value={employee.emergencyContact} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════ EMPLOYMENT TAB ════════════ */}
        {activeTab === "employment" && (
          <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border bg-[#F5F4F8]/60">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#49426E]">Position</h3>
              </div>
              <div className="p-5 grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoItem icon={BadgeCheck} label="HCM ID" value={employee.hcmId} mono />
                <InfoItem icon={Building2} label="Department" value={employee.department?.name} />
                <InfoItem icon={Hash} label="Designation" value={employee.designation} />
                <InfoItem icon={Hash} label="Grade" value={employee.grade} />
                <InfoItem icon={Hash} label="PGC Grade" value={employee.pgcGrade} />
                <InfoItem icon={Hash} label="Division" value={employee.division} />
                <InfoItem icon={Hash} label="Project" value={employee.project} />
                <InfoItem icon={Hash} label="Sub-Department" value={employee.subDepartment} />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border bg-[#F5F4F8]/60">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#49426E]">Key Dates</h3>
              </div>
              <div className="p-5 grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoItem icon={Calendar} label="Date of Joining" value={fmt(employee.doj)} />
                <InfoItem icon={Calendar} label="Confirmation" value={fmt(employee.confirmationDate)} />
                <InfoItem icon={CreditCard} label="CNIC Issue" value={fmt(employee.cnicIssueDate)} />
                <InfoItem icon={CreditCard} label="CNIC Expiry" value={fmt(employee.cnicExpiryDate)} />
                {employee.rejoiningDate && <InfoItem icon={Calendar} label="Rejoining" value={fmt(employee.rejoiningDate)} />}
                {employee.dol && <InfoItem icon={Calendar} label="Date of Leaving" value={fmt(employee.dol)} />}
                <InfoItem icon={Clock} label="Record Created" value={fmt(employee.createdAt)} />
              </div>
            </div>
          </div>
        )}

        {/* ════════════ ATTENDANCE TAB ════════════ */}
        {activeTab === "attendance" && (
          <div className="max-w-5xl">
            {activePeriod && attendanceSummary ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-extrabold text-[#322E53]">{activePeriod.label}</h2>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      {fmt(activePeriod.startDate)} – {fmt(activePeriod.endDate)}
                    </p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex gap-3 mb-5 flex-wrap">
                  {Object.entries(attendanceSummary.stats).map(([key, count]) => {
                    const s = STATUS_STYLE[key] ?? STATUS_STYLE.UNMARKED
                    return (
                      <div key={key} className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border", s.bg)}>
                        <span className={cn("text-lg font-extrabold leading-none", s.text)}>{count}</span>
                        <span className={cn("text-[9px] font-bold", s.text, "opacity-80")}>
                          {key.replace("_", " ")}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Records Table */}
                <div className="bg-white rounded-2xl border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#322E53] text-white">
                        <th className="text-left px-4 py-3 font-extrabold text-[10px] uppercase tracking-wider">Date</th>
                        <th className="text-left px-4 py-3 font-extrabold text-[10px] uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-3 font-extrabold text-[10px] uppercase tracking-wider">In Time</th>
                        <th className="text-left px-4 py-3 font-extrabold text-[10px] uppercase tracking-wider">Out Time</th>
                        <th className="text-right px-4 py-3 font-extrabold text-[10px] uppercase tracking-wider">Worked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceSummary.records.map((r, i) => {
                        const s = STATUS_STYLE[r.effectiveStatus] ?? STATUS_STYLE.UNMARKED
                        const worked = r.workedMinutes
                          ? `${Math.floor(r.workedMinutes / 60)}h ${r.workedMinutes % 60}m`
                          : "—"
                        return (
                          <tr key={r.date} className={i % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/40"}>
                            <td className="px-4 py-2.5 font-semibold text-[#322E53]">
                              {new Date(r.date + "T00:00:00").toLocaleDateString("en-GB", {
                                weekday: "short", day: "numeric", month: "short"
                              })}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold", s.bg, s.text)}>
                                {r.effectiveStatus.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono font-semibold text-[#322E53]">{r.inTime ?? "—"}</td>
                            <td className="px-4 py-2.5 font-mono font-semibold text-[#322E53]">{r.outTime ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-muted-foreground">{worked}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Activity className="w-10 h-10 text-[#EEC293] mb-3" />
                <p className="font-bold text-[#322E53] text-sm">No active attendance period</p>
                <p className="text-xs text-muted-foreground font-medium mt-1">Attendance data will appear here once a period is active.</p>
              </div>
            )}
          </div>
        )}

        {/* ════════════ STATUS HISTORY TAB ════════════ */}
        {activeTab === "history" && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-[#F5F4F8]/60">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#49426E]">Full Status History</h3>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  All status changes for {employee.name}, newest first.
                </p>
              </div>
              <div className="p-5">
                {employee.statusHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <Clock className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-sm font-bold text-muted-foreground">No status history yet.</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
                    <ol className="space-y-0">
                      {(employee.statusHistory as {
                        id: string; status: string; effectiveDate: Date; reason: string | null; createdAt: Date
                      }[]).map((h, i) => {
                        const isActiveStatus = h.status === "ACTIVE"
                        const isLatest = i === 0
                        return (
                          <li key={h.id} className="relative flex gap-5 pb-7 last:pb-0">
                            <div className="relative z-10 flex-shrink-0 mt-1">
                              <div className={cn(
                                "w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center",
                                isActiveStatus ? "bg-emerald-500" : "bg-slate-400"
                              )}>
                                <span className="text-white text-[10px] font-extrabold">
                                  {isActiveStatus ? "✓" : "✕"}
                                </span>
                              </div>
                            </div>
                            <div className={cn(
                              "flex-1 rounded-xl border p-4",
                              isActiveStatus ? "bg-emerald-50/60 border-emerald-200" : "bg-slate-50 border-slate-200",
                              isLatest && "ring-2 ring-offset-1 ring-[#322E53]/10"
                            )}>
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={cn(
                                      "text-sm font-extrabold",
                                      isActiveStatus ? "text-emerald-700" : "text-slate-600"
                                    )}>
                                      {isActiveStatus ? "Activated" : "Deactivated"}
                                    </span>
                                    {isLatest && (
                                      <span className="text-[9px] font-bold bg-[#322E53] text-white px-1.5 py-0.5 rounded-full uppercase">
                                        Current
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                                    Effective {fmt(h.effectiveDate)}
                                  </p>
                                </div>
                                <span className={cn(
                                  "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shrink-0",
                                  isActiveStatus ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                )}>
                                  {isActiveStatus ? "Active" : "Inactive"}
                                </span>
                              </div>
                              {h.reason && (
                                <p className="text-xs text-slate-500 italic mt-2 border-t border-current/10 pt-2">
                                  "{h.reason}"
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-2">Recorded {fmt(h.createdAt)}</p>
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
