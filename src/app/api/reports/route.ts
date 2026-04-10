import { NextRequest } from "next/server"
import { withPermission, json } from "@/lib/with-permission"
import { prisma } from "@/lib/prisma"
import { fmtWorked } from "@/lib/attendance-calc"
import { eachDayOfInterval } from "date-fns"
import type { Prisma, AttendanceStatus } from "@prisma/client"

// ── GET /api/reports ──────────────────────────────────────────────────────────
//
// Query params:
//   reportType:    in-out | absentees | dept-summary | dept-summary-regularity |
//                  dept-summary-division | individual | overtime | attendance
//   periodId:      string (required for period-based reports)
//   fromDate:      YYYY-MM-DD
//   toDate:        YYYY-MM-DD
//   departmentIds: comma-separated string IDs
//   employeeIds:   comma-separated string IDs
//   rank:          string (maps to grade field)
//   category:      staff | worker | management
//   employeeStatus: ACTIVE | INACTIVE | ALL (default ALL)

export async function GET(req: NextRequest) {
  const guard = await withPermission("reports:read")
  if (guard) return guard

  const { searchParams } = req.nextUrl
  const reportType    = searchParams.get("reportType") ?? "in-out"
  const periodId      = searchParams.get("periodId")   ?? ""
  const fromDate      = searchParams.get("fromDate")   ?? ""
  const toDate        = searchParams.get("toDate")     ?? ""
  const deptIdsRaw    = searchParams.get("departmentIds") ?? ""
  const empIdsRaw     = searchParams.get("employeeIds")   ?? ""
  const rank          = searchParams.get("rank")       ?? ""
  const category      = searchParams.get("category")   ?? ""
  const empStatus     = searchParams.get("employeeStatus") ?? "ALL"

  const departmentIds = deptIdsRaw ? deptIdsRaw.split(",").filter(Boolean) : []
  const employeeIds   = empIdsRaw  ? empIdsRaw.split(",").filter(Boolean)  : []

  // ── Date helpers ────────────────────────────────────────────────────────────
  function resolvedFrom(period: { startDate: Date } | null): Date {
    if (fromDate) return new Date(fromDate + "T00:00:00.000Z")
    if (period)   return new Date(period.startDate)
    return new Date()
  }
  function resolvedTo(period: { endDate: Date } | null): Date {
    if (toDate) return new Date(toDate + "T23:59:59.999Z")
    if (period) return new Date(period.endDate)
    return new Date()
  }
  function fmtDate(d: Date | null): string {
    return d ? d.toISOString().slice(0, 10) : "—"
  }

  // ── Employee base filter ───────────────────────────────────────────────────
  function empBaseWhere(): Prisma.EmployeeWhereInput {
    return {
      ...(departmentIds.length ? { departmentId: { in: departmentIds } } : {}),
      ...(employeeIds.length   ? { id: { in: employeeIds } }             : {}),
      ...(empStatus !== "ALL"  ? { status: empStatus as "ACTIVE" | "INACTIVE" } : {}),
      ...(rank     ? { grade: { contains: rank, mode: "insensitive" as const } } : {}),
      // category maps to subDepartment or designation pattern — stored as flexible text
      ...(category ? { designation: { contains: category, mode: "insensitive" as const } } : {}),
    }
  }

  // ── Period helper ──────────────────────────────────────────────────────────
  async function getPeriod() {
    if (!periodId) return null
    return prisma.attendancePeriod.findUnique({ where: { id: periodId } })
  }

  // ── Route by reportType ────────────────────────────────────────────────────

  // ── IN-OUT REPORT ──────────────────────────────────────────────────────────
  if (reportType === "in-out") {
    const period = await getPeriod()
    const from   = resolvedFrom(period)
    const to     = resolvedTo(period)

    const where: Prisma.AttendanceRecordWhereInput = {
      date: { gte: from, lte: to },
      employee: empBaseWhere(),
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      orderBy: [
        { employee: { department: { name: "asc" } } },
        { employee: { name: "asc" } },
        { date: "asc" },
      ],
      select: {
        id: true, date: true, inTime: true, outTime: true,
        workedMinutes: true, calculatedStatus: true, overriddenStatus: true, note: true,
        employee: {
          select: {
            hcmId: true, name: true, designation: true,
            department: { select: { name: true } },
          },
        },
      },
    })

    const rows = records.map((r) => ({
      id:           r.id,
      hcmId:        r.employee.hcmId,
      name:         r.employee.name,
      department:   r.employee.department?.name ?? "—",
      designation:  r.employee.designation ?? "—",
      date:         fmtDate(r.date),
      inTime:       r.inTime  ?? "—",
      outTime:      r.outTime ?? "—",
      workedHours:  r.workedMinutes ? fmtWorked(r.workedMinutes) : "—",
      status:       (r.overriddenStatus ?? r.calculatedStatus).replace("_", " "),
      note:         r.note ?? "",
    }))

    return json({ rows, total: rows.length, fromDate: fmtDate(from), toDate: fmtDate(to) })
  }

  // ── ABSENTEES ──────────────────────────────────────────────────────────────
  if (reportType === "absentees") {
    const period = await getPeriod()
    const from   = resolvedFrom(period)
    const to     = resolvedTo(period)

    const records = await prisma.attendanceRecord.findMany({
      where: {
        date:     { gte: from, lte: to },
        employee: empBaseWhere(),
        OR: [
          { overriddenStatus: "ABSENT" as AttendanceStatus },
          { AND: [{ overriddenStatus: null }, { calculatedStatus: "ABSENT" as AttendanceStatus }] },
        ],
      },
      orderBy: [
        { employee: { department: { name: "asc" } } },
        { employee: { name: "asc" } },
        { date: "asc" },
      ],
      select: {
        id: true, date: true, note: true,
        calculatedStatus: true, overriddenStatus: true,
        employee: {
          select: {
            hcmId: true, name: true, designation: true,
            department: { select: { name: true } },
          },
        },
      },
    })

    // Group by employee
    const empMap = new Map<string, {
      hcmId: string; name: string; department: string; designation: string
      absentDays: string[]; notes: string[]
    }>()

    for (const r of records) {
      const key = r.employee.hcmId
      if (!empMap.has(key)) {
        empMap.set(key, {
          hcmId:       r.employee.hcmId,
          name:        r.employee.name,
          department:  r.employee.department?.name ?? "—",
          designation: r.employee.designation ?? "—",
          absentDays:  [],
          notes:       [],
        })
      }
      const entry = empMap.get(key)!
      entry.absentDays.push(fmtDate(r.date))
      if (r.note) entry.notes.push(r.note)
    }

    const rows = [...empMap.values()].map((e) => ({
      ...e,
      absentCount: e.absentDays.length,
      dates:       e.absentDays.join(", "),
    }))

    return json({ rows, total: rows.length, fromDate: fmtDate(from), toDate: fmtDate(to) })
  }

  // ── DEPARTMENT SUMMARY ─────────────────────────────────────────────────────
  if (reportType === "dept-summary" || reportType === "dept-summary-regularity") {
    const period = await getPeriod()
    const from   = resolvedFrom(period)
    const to     = resolvedTo(period)

    const days     = eachDayOfInterval({ start: from, end: to })
    const workDays = days.filter((d) => d.getDay() !== 0).length

    const depts = await prisma.department.findMany({
      where: departmentIds.length ? { id: { in: departmentIds } } : undefined,
      orderBy: { code: "asc" },
    })

    const rows = await Promise.all(depts.map(async (dept) => {
      const records = await prisma.attendanceRecord.findMany({
        where: {
          date:     { gte: from, lte: to },
          employee: { departmentId: dept.id, ...empBaseWhere() },
        },
        select: { calculatedStatus: true, overriddenStatus: true },
      })

      const counts: Record<string, number> = {}
      for (const r of records) {
        const s = (r.overriddenStatus ?? r.calculatedStatus) as string
        counts[s] = (counts[s] ?? 0) + 1
      }

      const present = (counts.PRESENT ?? 0) + (counts.SHORT_TIME ?? 0) + (counts.HALF_DAY ?? 0)
      const total   = Object.values(counts).reduce((a, b) => a + b, 0)
      const empCount = await prisma.employee.count({
        where: { departmentId: dept.id, ...empBaseWhere() },
      })
      const regularity = workDays > 0 && empCount > 0
        ? Math.round((present / (workDays * empCount)) * 1000) / 10
        : 0

      return {
        department:  dept.name,
        code:        dept.code,
        employees:   empCount,
        workingDays: workDays,
        present:     counts.PRESENT     ?? 0,
        shortTime:   counts.SHORT_TIME  ?? 0,
        halfDay:     counts.HALF_DAY    ?? 0,
        absent:      counts.ABSENT      ?? 0,
        leave:       counts.LEAVE       ?? 0,
        missingIn:   counts.MISSING_IN  ?? 0,
        missingOut:  counts.MISSING_OUT ?? 0,
        unmarked:    counts.UNMARKED    ?? 0,
        totalRecords: total,
        regularity,
      }
    }))

    return json({ rows, total: rows.length, workingDays: workDays, fromDate: fmtDate(from), toDate: fmtDate(to) })
  }

  // ── DEPARTMENT SUMMARY DIVISION WISE ──────────────────────────────────────
  if (reportType === "dept-summary-division") {
    const period = await getPeriod()
    const from   = resolvedFrom(period)
    const to     = resolvedTo(period)

    const days     = eachDayOfInterval({ start: from, end: to })
    const workDays = days.filter((d) => d.getDay() !== 0).length

    const employees = await prisma.employee.findMany({
      where: empBaseWhere(),
      select: {
        division: true,
        attendance: {
          where: { date: { gte: from, lte: to } },
          select: { calculatedStatus: true, overriddenStatus: true },
        },
      },
    })

    // Group by division
    const divisionMap = new Map<string, {
      employees: number
      counts: Record<string, number>
    }>()

    for (const emp of employees) {
      const div = emp.division ?? "UNASSIGNED"
      if (!divisionMap.has(div)) divisionMap.set(div, { employees: 0, counts: {} })
      const entry = divisionMap.get(div)!
      entry.employees++
      for (const r of emp.attendance) {
        const s = (r.overriddenStatus ?? r.calculatedStatus) as string
        entry.counts[s] = (entry.counts[s] ?? 0) + 1
      }
    }

    const rows = [...divisionMap.entries()].map(([division, data]) => {
      const c = data.counts
      const present = (c.PRESENT ?? 0) + (c.SHORT_TIME ?? 0) + (c.HALF_DAY ?? 0)
      const regularity = workDays > 0 && data.employees > 0
        ? Math.round((present / (workDays * data.employees)) * 1000) / 10
        : 0
      return {
        division,
        employees:   data.employees,
        workingDays: workDays,
        present:     c.PRESENT     ?? 0,
        shortTime:   c.SHORT_TIME  ?? 0,
        halfDay:     c.HALF_DAY    ?? 0,
        absent:      c.ABSENT      ?? 0,
        leave:       c.LEAVE       ?? 0,
        missingIn:   c.MISSING_IN  ?? 0,
        missingOut:  c.MISSING_OUT ?? 0,
        unmarked:    c.UNMARKED    ?? 0,
        regularity,
      }
    })

    return json({ rows, total: rows.length, workingDays: workDays, fromDate: fmtDate(from), toDate: fmtDate(to) })
  }

  // ── INDIVIDUAL REPORT ──────────────────────────────────────────────────────
  if (reportType === "individual") {
    const period = await getPeriod()
    const from   = resolvedFrom(period)
    const to     = resolvedTo(period)

    if (employeeIds.length === 0 && departmentIds.length === 0) {
      return json({ error: "Please select at least one employee or department for Individual Report." }, 422)
    }

    const records = await prisma.attendanceRecord.findMany({
      where: {
        date:     { gte: from, lte: to },
        employee: empBaseWhere(),
      },
      orderBy: [
        { employee: { name: "asc" } },
        { date: "asc" },
      ],
      select: {
        id: true, date: true,
        inTime: true, outTime: true,
        workedMinutes: true,
        calculatedStatus: true, overriddenStatus: true,
        leaveType: true, note: true,
        employee: {
          select: {
            hcmId: true, name: true, designation: true,
            department: { select: { name: true } },
          },
        },
      },
    })

    const rows = records.map((r) => ({
      hcmId:        r.employee.hcmId,
      name:         r.employee.name,
      department:   r.employee.department?.name ?? "—",
      designation:  r.employee.designation ?? "—",
      date:         fmtDate(r.date),
      inTime:       r.inTime  ?? "—",
      outTime:      r.outTime ?? "—",
      workedHours:  r.workedMinutes ? fmtWorked(r.workedMinutes) : "—",
      status:       (r.overriddenStatus ?? r.calculatedStatus).replace(/_/g, " "),
      leaveType:    r.leaveType ?? "—",
      note:         r.note ?? "",
    }))

    return json({ rows, total: rows.length, fromDate: fmtDate(from), toDate: fmtDate(to) })
  }

  // ── OVERTIME REPORT ────────────────────────────────────────────────────────
  if (reportType === "overtime") {
    const period = await getPeriod()
    const from   = resolvedFrom(period)
    const to     = resolvedTo(period)

    // Get shift config for overtime threshold
    const shift = await prisma.shiftConfig.findFirst({ where: { isDefault: true } })
    const stdMinutes = shift?.presentMinutes ?? 465

    const records = await prisma.attendanceRecord.findMany({
      where: {
        date:          { gte: from, lte: to },
        workedMinutes: { gt: stdMinutes },
        employee:      empBaseWhere(),
      },
      orderBy: [
        { employee: { department: { name: "asc" } } },
        { employee: { name: "asc" } },
        { date: "asc" },
      ],
      select: {
        date: true, inTime: true, outTime: true, workedMinutes: true,
        employee: {
          select: {
            hcmId: true, name: true, designation: true,
            department: { select: { name: true } },
          },
        },
      },
    })

    const rows = records.map((r) => {
      const overtime = (r.workedMinutes ?? 0) - stdMinutes
      return {
        hcmId:         r.employee.hcmId,
        name:          r.employee.name,
        department:    r.employee.department?.name ?? "—",
        designation:   r.employee.designation ?? "—",
        date:          fmtDate(r.date),
        inTime:        r.inTime  ?? "—",
        outTime:       r.outTime ?? "—",
        workedHours:   r.workedMinutes ? fmtWorked(r.workedMinutes) : "—",
        stdHours:      fmtWorked(stdMinutes),
        overtimeHours: fmtWorked(overtime),
        overtimeMins:  overtime,
      }
    })

    return json({ rows, total: rows.length, stdMinutes, fromDate: fmtDate(from), toDate: fmtDate(to) })
  }

  // ── ATTENDANCE (MONTHLY GRID SUMMARY) ─────────────────────────────────────
  if (reportType === "attendance") {
    const period = await getPeriod()
    const from   = resolvedFrom(period)
    const to     = resolvedTo(period)

    const days     = eachDayOfInterval({ start: from, end: to })
    const workDays = days.filter((d) => d.getDay() !== 0).length

    const employees = await prisma.employee.findMany({
      where:   { attendance: { some: { date: { gte: from, lte: to } } }, ...empBaseWhere() },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
      select: {
        hcmId: true, name: true, designation: true,
        department: { select: { name: true } },
        attendance: {
          where:  { date: { gte: from, lte: to } },
          select: { calculatedStatus: true, overriddenStatus: true },
        },
      },
    })

    const rows = employees.map((emp) => {
      const c: Record<string, number> = {}
      for (const r of emp.attendance) {
        const s = (r.overriddenStatus ?? r.calculatedStatus) as string
        c[s] = (c[s] ?? 0) + 1
      }
      const present = (c.PRESENT ?? 0) + (c.SHORT_TIME ?? 0) + (c.HALF_DAY ?? 0)
      return {
        hcmId:       emp.hcmId,
        name:        emp.name,
        department:  emp.department?.name ?? "—",
        designation: emp.designation ?? "—",
        workingDays: workDays,
        present:     c.PRESENT     ?? 0,
        shortTime:   c.SHORT_TIME  ?? 0,
        halfDay:     c.HALF_DAY    ?? 0,
        absent:      c.ABSENT      ?? 0,
        leave:       c.LEAVE       ?? 0,
        missingIn:   c.MISSING_IN  ?? 0,
        missingOut:  c.MISSING_OUT ?? 0,
        unmarked:    c.UNMARKED    ?? 0,
        attendancePct: workDays > 0
          ? Math.round((present / workDays) * 1000) / 10
          : 0,
      }
    })

    return json({
      rows, total: rows.length, workingDays: workDays,
      fromDate: fmtDate(from), toDate: fmtDate(to),
      periodLabel: period?.label ?? "",
    })
  }

  return json({ error: `Unknown report type: ${reportType}` }, 400)
}
