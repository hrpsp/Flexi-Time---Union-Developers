import { notFound, redirect } from "next/navigation"
import { format, eachDayOfInterval } from "date-fns"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { GridShell } from "@/components/attendance/grid-shell"
import type { DayInfo, DeptInfo, PeriodInfo, ShiftInfo } from "@/components/attendance/grid-shell"

export const dynamic = "force-dynamic"

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps) {
  const period = await prisma.attendancePeriod.findUnique({ where: { id: params.id } })
  return { title: period ? `${period.label} — Attendance` : "Attendance Grid" }
}

export default async function AttendanceGridPage({ params }: PageProps) {
  // ── Auth & permission ────────────────────────────────────────────────────
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (!hasPermission(session.user.role, "attendance:read")) redirect("/attendance")
  const canOverride = hasPermission(session.user.role, "attendance:override")

  // ── Fetch period ─────────────────────────────────────────────────────────
  const period = await prisma.attendancePeriod.findUnique({ where: { id: params.id } })
  if (!period) notFound()

  const periodInfo: PeriodInfo = {
    id:        period.id,
    label:     period.label,
    startDate: period.startDate.toISOString().slice(0, 10),
    endDate:   period.endDate.toISOString().slice(0, 10),
    isActive:  period.isActive,
  }

  // ── Build days array ─────────────────────────────────────────────────────
  const days: DayInfo[] = eachDayOfInterval({
    start: new Date(period.startDate),
    end:   new Date(period.endDate),
  }).map((d) => ({
    dateStr:    format(d, "yyyy-MM-dd"),
    dayNum:     d.getDate(),
    dayAbbr:    format(d, "EEE"),
    isSunday:   d.getDay() === 0,
    isSaturday: d.getDay() === 6,
  }))

  // ── Departments with employee counts for this period ─────────────────────
  // Group employees who have records in this period by department
  const deptGroups = await prisma.employee.groupBy({
    by:    ["departmentId"],
    where: { attendance: { some: { periodId: period.id } } },
    _count: { id: true },
  })

  const deptIds = deptGroups.map((g) => g.departmentId)

  const deptDetails = await prisma.department.findMany({
    where:   { id: { in: deptIds } },
    select:  { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  })

  const departments: DeptInfo[] = deptDetails.map((d) => ({
    ...d,
    count: deptGroups.find((g) => g.departmentId === d.id)?._count.id ?? 0,
  }))

  const totalCount = deptGroups.reduce((sum, g) => sum + g._count.id, 0)

  // ── Active shift config ───────────────────────────────────────────────────
  const shift = await prisma.shiftConfig.findFirst({ where: { isDefault: true } })
  const shiftInfo: ShiftInfo | null = shift
    ? {
        name:           shift.name,
        presentMinutes: shift.presentMinutes,
        shortTimeMin:   shift.shortTimeMin,
        halfDayMin:     shift.halfDayMin,
      }
    : null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <GridShell
      period={periodInfo}
      days={days}
      departments={departments}
      totalCount={totalCount}
      shiftInfo={shiftInfo}
      canOverride={canOverride}
    />
  )
}
