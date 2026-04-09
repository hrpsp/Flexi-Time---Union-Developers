"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts"
import { BarChart3 } from "lucide-react"

// Status colours matching the app palette
const STATUS_COLORS: Record<string, string> = {
  PRESENT:     "#059669",
  SHORT_TIME:  "#D97706",
  HALF_DAY:    "#EA580C",
  ABSENT:      "#DC2626",
  LEAVE:       "#7C3AED",
  MISSING_IN:  "#DB2777",
  MISSING_OUT: "#C026D3",
  UNMARKED:    "#94A3B8",
}

const STATUS_LABELS: Record<string, string> = {
  PRESENT:     "Present",
  SHORT_TIME:  "Short Time",
  HALF_DAY:    "Half Day",
  ABSENT:      "Absent",
  LEAVE:       "Leave",
  MISSING_IN:  "Missing In",
  MISSING_OUT: "Missing Out",
  UNMARKED:    "Unmarked",
}

const STACK_ORDER = ["PRESENT", "SHORT_TIME", "HALF_DAY", "ABSENT", "LEAVE", "MISSING_IN", "MISSING_OUT", "UNMARKED"]

export interface ByDeptData extends Record<string, unknown> {
  dept: string
}

interface AttendanceBarChartProps {
  data: ByDeptData[]
}

export function AttendanceBarChart({ data }: AttendanceBarChartProps) {
  if (!data.length) {
    return (
      <div className="bg-white rounded-2xl border border-border p-6 flex flex-col items-center justify-center h-64 text-center">
        <BarChart3 className="w-8 h-8 text-[#EEC293] mb-2" />
        <p className="text-sm font-bold text-[#322E53]">No department data</p>
        <p className="text-xs text-muted-foreground font-medium mt-1">Upload attendance data to see the chart.</p>
      </div>
    )
  }

  // Find which statuses are actually present in the data
  const activeStatuses = STACK_ORDER.filter((s) =>
    data.some((d) => (d[s] as number | undefined ?? 0) > 0)
  )

  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#322E53]">Attendance by Department</h3>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">Stacked by status for the active period</p>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F0F6" vertical={false} />
          <XAxis
            dataKey="dept"
            tick={{ fontSize: 11, fill: "#49426E", fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94A3B8" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#322E53", border: "none", borderRadius: 10,
              color: "#fff", fontSize: 12, padding: "8px 12px",
            }}
            cursor={{ fill: "#F5F4F8" }}
            formatter={(val, name) => [val, STATUS_LABELS[String(name)] ?? String(name)]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
            formatter={(val) => STATUS_LABELS[val] ?? val}
          />
          {activeStatuses.map((status) => (
            <Bar
              key={status}
              dataKey={status}
              stackId="a"
              fill={STATUS_COLORS[status] ?? "#94A3B8"}
              radius={status === activeStatuses[activeStatuses.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
