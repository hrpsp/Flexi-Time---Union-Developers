"use client"

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts"
import { TrendingUp } from "lucide-react"

export interface TrendData {
  date:       string
  presentPct: number
}

interface DailyTrendChartProps {
  data: TrendData[]
}

export function DailyTrendChart({ data }: DailyTrendChartProps) {
  if (!data.length) {
    return (
      <div className="bg-white rounded-2xl border border-border p-6 flex flex-col items-center justify-center h-52 text-center">
        <TrendingUp className="w-8 h-8 text-[#EEC293] mb-2" />
        <p className="text-sm font-bold text-[#322E53]">No trend data</p>
        <p className="text-xs text-muted-foreground font-medium mt-1">Data appears after attendance is uploaded.</p>
      </div>
    )
  }

  const avg = Math.round(data.reduce((s, d) => s + d.presentPct, 0) / data.length)

  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#322E53]">Daily Attendance Trend</h3>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">Present % over the last 30 days</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground font-medium">30-day avg</p>
          <p className="text-lg font-extrabold text-[#322E53]">{avg}%</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F0F6" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#94A3B8" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "#94A3B8" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: "#322E53", border: "none", borderRadius: 10,
              color: "#fff", fontSize: 12, padding: "8px 12px",
            }}
            formatter={(v) => [`${v}%`, "Present"]}
          />
          <ReferenceLine y={avg} stroke="#EEC293" strokeDasharray="4 2" strokeWidth={1.5} />
          <Line
            type="monotone"
            dataKey="presentPct"
            stroke="#322E53"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: "#322E53", stroke: "#EEC293", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
