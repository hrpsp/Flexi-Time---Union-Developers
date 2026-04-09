"use client"

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { PieChart as PieIcon } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  PRESENT:     "#059669",
  SHORT_TIME:  "#D97706",
  HALF_DAY:    "#EA580C",
  ABSENT:      "#DC2626",
  LEAVE:       "#7C3AED",
  MISSING_IN:  "#DB2777",
  MISSING_OUT: "#C026D3",
  UNMARKED:    "#94A3B8",
  OFF:         "#CBD5E1",
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
  OFF:         "Day Off",
}

export interface DistData {
  name:  string
  value: number
}

interface StatusDonutChartProps {
  data: DistData[]
}

export function StatusDonutChart({ data }: StatusDonutChartProps) {
  if (!data.length) {
    return (
      <div className="bg-white rounded-2xl border border-border p-6 flex flex-col items-center justify-center h-52 text-center">
        <PieIcon className="w-8 h-8 text-[#EEC293] mb-2" />
        <p className="text-sm font-bold text-[#322E53]">No data</p>
        <p className="text-xs text-muted-foreground font-medium mt-1">Status distribution will appear here.</p>
      </div>
    )
  }

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="mb-2">
        <h3 className="text-sm font-bold text-[#322E53]">Status Distribution</h3>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">{total.toLocaleString()} records — active period</p>
      </div>

      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="shrink-0" style={{ width: 180, height: 180, position: "relative" }}>
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={2}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.name] ?? "#CBD5E1"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#322E53", border: "none", borderRadius: 10,
                  color: "#fff", fontSize: 12, padding: "8px 12px",
                }}
                formatter={(v, name) => [
                  typeof v === "number" ? `${v} (${Math.round((v / total) * 100)}%)` : String(v),
                  STATUS_LABELS[String(name)] ?? String(name),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Centre label */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            style={{ top: 0 }}
          >
            <p className="text-xl font-extrabold text-[#322E53] leading-none">{total}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">records</p>
          </div>
        </div>

        {/* Legend list */}
        <div className="flex-1 space-y-1.5 min-w-0">
          {data
            .sort((a, b) => b.value - a.value)
            .map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: STATUS_COLORS[d.name] ?? "#CBD5E1" }}
                />
                <span className="text-xs font-medium text-slate-600 flex-1 truncate">
                  {STATUS_LABELS[d.name] ?? d.name}
                </span>
                <span className="text-xs font-bold text-[#322E53] shrink-0">{d.value}</span>
                <span className="text-[10px] text-slate-400 font-medium shrink-0 w-9 text-right">
                  {Math.round((d.value / total) * 100)}%
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
