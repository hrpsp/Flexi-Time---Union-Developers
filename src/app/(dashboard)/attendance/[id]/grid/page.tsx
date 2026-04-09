import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { format, eachDayOfInterval } from "date-fns"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { STATUS_META } from "@/lib/attendance-calc"
import type { AttendanceStatusCode } from "@/lib/attendance-calc"
import { cn } from "@/lib/utils"
import { ChevronLeft, CalendarRange, Download } from "lucide-react"

export const dynamic = "force-dynamic"

interface PageProps {
  params: { id: string }
}

export default async function AttendanceGridPage({ params }: PageProps) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasPermission(session.user.role, "attendance:read")) redirect("/attendance")

  // ── Fetch period ─────────────────────────────────────────────────────────
  const period = await prisma.attendancePeriod.findUnique({
    where:   { id: params.id },
    include: { _count: { select: { records: true } } },
  })
  if (!period) notFound()

  // ── Generate date range ───────────────────────────────────────────────────
  const start = new Date(period.startDate)
  const end   = new Date(period.endDate)
  const days  = eachDayOfInterval({ start, end })

  // ── Fetch all records for this period ─────────────────────────────────────
  const records = await prisma.attendanceRecord.findMany({
    where:   { periodId: period.id },
    select: {
      employeeId:       true,
      date:             true,
      inTime:           true,
      outTime:          true,
      workedMinutes:    true,
      calculatedStatus: true,
      overriddenStatus: true,
    },
  })

  // ── Build record lookup: employeeId → date string → record ───────────────
  const recordMap = new Map<string, Map<string, typeof records[0]>>()
  for (const rec of records) {
    const dateKey = rec.date.toISOString().slice(0, 10)
    if (!recordMap.has(rec.employeeId)) recordMap.set(rec.employeeId, new Map())
    recordMap.get(rec.employeeId)!.set(dateKey, rec)
  }

  // ── Fetch employees who have records in this period ───────────────────────
  const employeeIds = [...recordMap.keys()]
  const employees = employeeIds.length > 0
    ? await prisma.employee.findMany({
        where:   { id: { in: employeeIds } },
        orderBy: { name: "asc" },
        select: {
          id:          true,
          hcmId:       true,
          name:        true,
          designation: true,
          department:  { select: { name: true } },
        },
      })
    : []

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const statCounts: Record<string, number> = {}
  for (const rec of records) {
    const status = rec.overriddenStatus ?? rec.calculatedStatus
    statCounts[status] = (statCounts[status] ?? 0) + 1
  }

  const fmtDate  = (d: Date) => format(d, "dd MMM yyyy")
  const fmtShort = (d: Date) => format(d, "dd")
  const fmtDay   = (d: Date) => format(d, "EEE")

  return (
    <div className="p-6 max-w-full mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/attendance"
            className="mt-0.5 w-9 h-9 rounded-xl border border-border flex items-center justify-center
                       text-muted-foreground hover:bg-[#F5F4F8] hover:text-[#322E53] transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 mb-0.5">
              <CalendarRange className="w-5 h-5 text-[#322E53]" />
              <h2 className="text-xl font-extrabold text-[#322E53] leading-tight tracking-tight">
                {period.label}
              </h2>
              {period.isActive && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              {fmtDate(start)} — {fmtDate(end)} · {days.length} days · {employees.length} employees · {records.length} records
            </p>
          </div>
        </div>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(STATUS_META) as [AttendanceStatusCode, typeof STATUS_META[AttendanceStatusCode]][])
          .filter(([key]) => statCounts[key])
          .map(([key, meta]) => (
            <div
              key={key}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold",
                meta.bg, meta.text,
                "border-current/20"
              )}
            >
              <span className="font-extrabold">{meta.abbr || key}</span>
              <span className="opacity-70">= {key.replace("_", " ")}</span>
              <span className="font-extrabold">({statCounts[key]})</span>
            </div>
          ))}
      </div>

      {/* Grid */}
      {employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-border text-center">
          <CalendarRange className="w-10 h-10 text-[#EEC293] mb-3" />
          <p className="font-bold text-[#322E53]">No attendance records</p>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            Upload biometric data for this period to see the grid.
          </p>
          <Link
            href="/attendance"
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#322E53] text-white
                       text-sm font-bold hover:bg-[#49426E] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Attendance
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-auto">
            <table className="text-xs border-collapse" style={{ minWidth: "max-content" }}>
              <thead>
                {/* Date row */}
                <tr className="bg-[#322E53] text-white">
                  {/* Sticky employee header */}
                  <th
                    className="sticky left-0 z-20 bg-[#322E53] px-4 py-3 text-left text-[10px] font-extrabold
                               uppercase tracking-wider whitespace-nowrap border-r border-white/10"
                    style={{ minWidth: "220px" }}
                  >
                    Employee
                  </th>
                  {days.map((day) => {
                    const isSun = day.getDay() === 0
                    const isSat = day.getDay() === 6
                    return (
                      <th
                        key={day.toISOString()}
                        className={cn(
                          "px-1.5 py-3 text-center font-extrabold whitespace-nowrap border-r border-white/10",
                          (isSat || isSun) ? "bg-[#49426E]" : ""
                        )}
                        style={{ minWidth: "44px" }}
                      >
                        <div className="text-[11px]">{fmtShort(day)}</div>
                        <div className="text-[9px] opacity-60 font-semibold">{fmtDay(day)}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>

              <tbody>
                {employees.map((emp, ei) => {
                  const empRecords = recordMap.get(emp.id) ?? new Map()
                  return (
                    <tr
                      key={emp.id}
                      className={cn(
                        "border-b border-border",
                        ei % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/30"
                      )}
                    >
                      {/* Employee name cell (sticky) */}
                      <td
                        className={cn(
                          "sticky left-0 z-10 px-4 py-2.5 border-r border-border whitespace-nowrap",
                          ei % 2 === 0 ? "bg-white" : "bg-[#F5F4F8]/50"
                        )}
                      >
                        <div className="font-semibold text-[#322E53] text-xs leading-tight">{emp.name}</div>
                        <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                          {emp.hcmId}
                          {emp.department && ` · ${emp.department.name}`}
                        </div>
                      </td>

                      {/* Day cells */}
                      {days.map((day) => {
                        const dateKey = day.toISOString().slice(0, 10)
                        const rec     = empRecords.get(dateKey)
                        const isSun   = day.getDay() === 0
                        const isSat   = day.getDay() === 6

                        if (!rec) {
                          return (
                            <td
                              key={dateKey}
                              className={cn(
                                "px-1 py-2.5 text-center border-r border-border",
                                (isSat || isSun) ? "bg-slate-100/60" : ""
                              )}
                            >
                              <span className="text-slate-300 text-[10px] font-semibold">—</span>
                            </td>
                          )
                        }

                        const effectiveStatus = (rec.overriddenStatus ?? rec.calculatedStatus) as AttendanceStatusCode
                        const meta  = STATUS_META[effectiveStatus]
                        const isOvr = !!rec.overriddenStatus

                        return (
                          <td
                            key={dateKey}
                            className={cn(
                              "px-1 py-2.5 text-center border-r border-border",
                              (isSat || isSun) ? "bg-slate-50" : ""
                            )}
                          >
                            <div
                              className={cn(
                                "inline-flex items-center justify-center w-8 h-7 rounded-md font-extrabold text-[10px] transition-colors",
                                meta.bg, meta.text,
                                isOvr && "ring-1 ring-current ring-offset-1"
                              )}
                              title={[
                                effectiveStatus.replace("_", " "),
                                rec.inTime && rec.outTime ? `${rec.inTime} – ${rec.outTime}` : "",
                                rec.workedMinutes
                                  ? `${Math.floor(rec.workedMinutes / 60)}h ${rec.workedMinutes % 60}m`
                                  : "",
                                isOvr ? "(overridden)" : "",
                              ].filter(Boolean).join(" · ")}
                            >
                              {meta.abbr || effectiveStatus.slice(0, 2)}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer summary */}
      {employees.length > 0 && (
        <div className="text-xs text-muted-foreground font-medium text-center">
          {employees.length} employees · {days.length} days · {records.length} total records
          {Object.entries(statCounts).length > 0 && (
            <> · {Object.entries(statCounts).map(([s, c]) => `${STATUS_META[s as AttendanceStatusCode]?.abbr ?? s}: ${c}`).join(", ")}</>
          )}
        </div>
      )}
    </div>
  )
}
