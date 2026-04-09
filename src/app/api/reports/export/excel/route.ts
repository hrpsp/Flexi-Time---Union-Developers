import { withPermission, json } from "@/lib/with-permission"
import { prisma } from "@/lib/prisma"
import { fmtWorked } from "@/lib/attendance-calc"
import { eachDayOfInterval } from "date-fns"
import { z } from "zod"
import * as XLSX from "xlsx"
import type { Prisma } from "@prisma/client"

const schema = z.object({
  reportType: z.enum(["daily", "monthly-summary", "employee-status"]),
  filters:    z.record(z.unknown()),
})

// ── POST /api/reports/export/excel ────────────────────────────────────────────
export async function POST(req: Request) {
  const guard = await withPermission("reports:export")
  if (guard) return guard

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const { reportType, filters } = parsed.data
  const generatedAt = new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })

  let sheetName  = "Report"
  let reportTitle = "Report"
  let headers: string[] = []
  let dataRows: (string | number)[][] = []
  let totalsRow: (string | number)[] | null = null
  let subTitle   = ""

  // ── Daily Report ────────────────────────────────────────────────────────────
  if (reportType === "daily") {
    const date          = filters.date as string ?? ""
    const departmentIds = filters.departmentIds as string[] | undefined
    const statuses      = filters.statuses      as string[] | undefined

    const dateObj = new Date(date + "T00:00:00.000Z")
    const where: Prisma.AttendanceRecordWhereInput = {
      date: dateObj,
      ...(departmentIds?.length ? { employee: { departmentId: { in: departmentIds } } } : {}),
      ...(statuses?.length
        ? {
            OR: [
              { overriddenStatus: { in: statuses as Prisma.EnumAttendanceStatusFilter["in"] } },
              { AND: [{ overriddenStatus: null }, { calculatedStatus: { in: statuses as Prisma.EnumAttendanceStatusFilter["in"] } }] },
            ],
          }
        : {}),
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      orderBy: [{ employee: { department: { name: "asc" } } }, { employee: { name: "asc" } }],
      select: {
        inTime: true, outTime: true, workedMinutes: true,
        calculatedStatus: true, overriddenStatus: true, note: true,
        employee: { select: { hcmId: true, name: true, department: { select: { name: true } } } },
      },
    })

    sheetName  = "Daily Attendance"
    reportTitle = "Daily Attendance Report"
    subTitle   = `Date: ${date}`
    headers    = ["HCM ID", "Name", "Department", "IN Time", "OUT Time", "Worked Hours", "Status", "Note"]
    dataRows   = records.map((r) => [
      r.employee.hcmId ?? "",
      r.employee.name,
      r.employee.department?.name ?? "",
      r.inTime  ?? "",
      r.outTime ?? "",
      r.workedMinutes ? fmtWorked(r.workedMinutes) : "",
      (r.overriddenStatus ?? r.calculatedStatus).replace("_", " "),
      r.note ?? "",
    ])
  }

  // ── Monthly Summary ─────────────────────────────────────────────────────────
  else if (reportType === "monthly-summary") {
    const periodId       = filters.periodId       as string
    const departmentIds  = filters.departmentIds  as string[] | undefined
    const employeeStatus = (filters.employeeStatus as string | undefined) ?? "ALL"

    const period = await prisma.attendancePeriod.findUnique({ where: { id: periodId } })
    if (!period) return json({ error: "Period not found." }, 404)

    const days        = eachDayOfInterval({ start: new Date(period.startDate), end: new Date(period.endDate) })
    const workingDays = days.filter((d) => d.getDay() !== 0).length

    const employees = await prisma.employee.findMany({
      where: {
        attendance: { some: { periodId } },
        ...(departmentIds?.length ? { departmentId: { in: departmentIds } } : {}),
        ...(employeeStatus !== "ALL" ? { status: employeeStatus as "ACTIVE" | "INACTIVE" } : {}),
      },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
      select: {
        hcmId: true, name: true, designation: true,
        department: { select: { name: true } },
        attendance: { where: { periodId }, select: { calculatedStatus: true, overriddenStatus: true } },
      },
    })

    sheetName  = "Monthly Summary"
    reportTitle = "Monthly Summary Report"
    subTitle   = `Period: ${period.label} | Working Days: ${workingDays}`
    headers    = ["HCM ID", "Name", "Department", "Designation", "Working Days", "Present", "Short Time", "Half Day", "Absent", "Leave", "Missing In", "Missing Out", "Unmarked", "Attendance %"]

    const totals = { P: 0, ST: 0, H: 0, A: 0, L: 0, MI: 0, MO: 0, U: 0 }

    dataRows = employees.map((emp) => {
      const c: Record<string, number> = { PRESENT: 0, SHORT_TIME: 0, HALF_DAY: 0, ABSENT: 0, LEAVE: 0, MISSING_IN: 0, MISSING_OUT: 0, UNMARKED: 0 }
      for (const rec of emp.attendance) {
        const s = (rec.overriddenStatus ?? rec.calculatedStatus) as string
        c[s] = (c[s] ?? 0) + 1
      }
      const attDays = c.PRESENT + c.SHORT_TIME + c.HALF_DAY
      const attPct  = workingDays > 0 ? Math.round((attDays / workingDays) * 1000) / 10 : 0
      totals.P  += c.PRESENT; totals.ST += c.SHORT_TIME; totals.H  += c.HALF_DAY
      totals.A  += c.ABSENT;  totals.L  += c.LEAVE;      totals.MI += c.MISSING_IN
      totals.MO += c.MISSING_OUT; totals.U  += c.UNMARKED
      return [emp.hcmId ?? "", emp.name, emp.department?.name ?? "", emp.designation ?? "", workingDays,
        c.PRESENT, c.SHORT_TIME, c.HALF_DAY, c.ABSENT, c.LEAVE, c.MISSING_IN, c.MISSING_OUT, c.UNMARKED, attPct]
    })

    const totalAttDays = totals.P + totals.ST + totals.H
    const avgPct = employees.length > 0
      ? Math.round((totalAttDays / (workingDays * employees.length)) * 1000) / 10 : 0
    totalsRow = ["", "TOTALS", "", "", "", totals.P, totals.ST, totals.H, totals.A, totals.L, totals.MI, totals.MO, totals.U, avgPct]
  }

  // ── Employee Status ─────────────────────────────────────────────────────────
  else {
    const departmentIds = filters.departmentIds as string[] | undefined
    const status        = (filters.status as string | undefined) ?? "ALL"

    const employees = await prisma.employee.findMany({
      where: {
        ...(departmentIds?.length ? { departmentId: { in: departmentIds } } : {}),
        ...(status !== "ALL" ? { status: status as "ACTIVE" | "INACTIVE" } : {}),
      },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
      select: {
        hcmId: true, name: true, designation: true, status: true,
        doj: true, dol: true, rejoiningDate: true,
        department: { select: { name: true } },
        statusHistory: { orderBy: { effectiveDate: "desc" }, take: 1, select: { reason: true } },
      },
    })

    sheetName  = "Employee Status"
    reportTitle = "Employee Status Report"
    subTitle   = `Status: ${status} | Total: ${employees.length}`
    headers    = ["HCM ID", "Name", "Department", "Designation", "Status", "Date of Joining", "Date of Leaving", "Rejoining Date", "Total Days", "Reason"]

    dataRows = employees.map((emp) => {
      const start = emp.rejoiningDate ?? emp.doj
      const days  = start
        ? emp.status === "ACTIVE"
          ? Math.floor((Date.now() - start.getTime()) / 86_400_000)
          : emp.dol ? Math.max(0, Math.floor((emp.dol.getTime() - start.getTime()) / 86_400_000)) : ""
        : ""
      return [
        emp.hcmId ?? "", emp.name, emp.department?.name ?? "", emp.designation ?? "",
        emp.status,
        emp.doj           ? emp.doj.toISOString().slice(0, 10)           : "",
        emp.dol           ? emp.dol.toISOString().slice(0, 10)           : "",
        emp.rejoiningDate ? emp.rejoiningDate.toISOString().slice(0, 10) : "",
        days,
        emp.statusHistory[0]?.reason ?? "",
      ]
    })
  }

  // ── Build workbook ────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()

  const wsData: (string | number)[][] = [
    ["Flexi Time — Union Developers"],
    [`${reportTitle} | ${subTitle} | Generated: ${generatedAt}`],
    [],
    headers,
    ...dataRows,
    ...(totalsRow ? [totalsRow] : []),
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  const colWidths = headers.map((h, i) => {
    const maxDataLen = Math.max(h.length, ...dataRows.map((r) => String(r[i] ?? "").length))
    return { wch: Math.min(Math.max(maxDataLen + 2, 10), 40) }
  })
  ws["!cols"] = colWidths

  // Merge title cell across all columns
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
  ]

  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const buffer   = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  const filename = `${sheetName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`

  return new Response(buffer, {
    status:  200,
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
