import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { eachDayOfInterval } from "date-fns"
import { GridShell } from "@/components/attendance/grid-shell"
import type { DayInfo, DeptInfo, PeriodInfo, ShiftInfo } from "@/components/attendance/grid-shell"

export const dynamic = "force-dynamic"

interface PageProps {
  params: { id: string }
}

export default async function AttendanceGridPage({ params }: PageProps) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasPermission(session.user.role, "attendance:read")) redirect("/attendance")

  const canOverride = hasPermission(session.user.role, "attendance:override")

  // ── Fetch period ────────────────────────────────────────────────────────
  const period = await prisma.attendancePeriod.findUnique({
    where:   { id: params.id },
    include: { _count: { select: { records: true } } },
  })
  if (!period) notFound()

  // ── Build days array ─────────────────────────────────────────────────────
  const start = new Date(period.startDate)
  const end   = new Date(period.endDate)
  const days: DayInfo[] = eachDayOfInterval({ start, end }).map((d) => ({
    dateStr:    d.toISOString().slice(0, 10),
    dayNum:     d.getDate(),
    dayAbbr:    d.toLocaleDateString("en-US", { weekday: "short" }),
    isSunday:   d.getDay() === 0,
    isSaturday: d.getDay() === 6,
  }))

  // ── Fetch departments that have employees ────────────────────────────────
  const rawDepts = await prisma.department.findMany({
    where:   { employees: { some: { status: "ACTIVE" } } },
    orderBy: { code: "asc" },
    select:  { id: true, name: true, code: true, _count: { select: { employees: { where: { status: "ACTIVE" } } } } },
  })
  const departments: DeptInfo[] = rawDepts.map((d) => ({
    id:    d.id,
    name:  d.name,
    code:  d.code,
    count: d._count.employees,
  }))

  // ── Fetch shift config ───────────────────────────────────────────────────
  const shiftCfg = await prisma.shiftConfig.findFirst({ where: { isDefault: true } })
  const shiftInfo: ShiftInfo | null = shiftCfg
    ? { name: shiftCfg.name, presentMinutes: shiftCfg.presentMinutes, shortTimeMin: shiftCfg.shortTimeMin, halfDayMin: shiftCfg.halfDayMin }
    : null

  const periodInfo: PeriodInfo = {
    id:        period.id,
    label:     period.label,
    startDate: period.startDate.toISOString().slice(0, 10),
    endDate:   period.endDate.toISOString().slice(0, 10),
    isActive:  period.isActive,
  }

  return (
    <GridShell
      period={periodInfo}
      days={days}
      departments={departments}
      totalCount={period._count.records}
      shiftInfo={shiftInfo}
      canOverride={canOverride}
    />
  )
}
