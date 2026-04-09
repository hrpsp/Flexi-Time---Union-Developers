import { formatDistanceToNow } from "date-fns"
import { Activity } from "lucide-react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ActivityEntry {
  id:         string
  action:     string
  entityType: string
  createdAt:  string   // ISO string (serializable from server)
  userName:   string
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_PHRASES: Record<string, string> = {
  "override":        "overrode",
  "clear-override":  "cleared override on",
  "create":          "created",
  "update":          "updated",
  "delete":          "deleted",
  "deactivate":      "deactivated",
  "activate":        "reactivated",
  "upload":          "uploaded attendance for",
  "sync":            "synced records for",
  "bulk-override":   "applied bulk override on",
  "set-default":     "set default shift",
  "activate-period": "activated period",
}

const ENTITY_LABELS: Record<string, string> = {
  "AttendanceRecord":  "an attendance record",
  "Employee":          "an employee",
  "User":              "a user",
  "AttendancePeriod":  "attendance period",
  "Department":        "a department",
  "ShiftConfig":       "a shift profile",
  "EmailTemplate":     "an email template",
}

const ACTION_COLORS: Record<string, string> = {
  "override":        "bg-amber-400",
  "clear-override":  "bg-slate-400",
  "create":          "bg-emerald-500",
  "update":          "bg-blue-500",
  "delete":          "bg-red-500",
  "deactivate":      "bg-red-400",
  "activate":        "bg-emerald-400",
  "upload":          "bg-[#322E53]",
  "sync":            "bg-[#49426E]",
  "bulk-override":   "bg-orange-500",
}

function formatLog(action: string, entityType: string, userName: string): string {
  const phrase = ACTION_PHRASES[action] ?? action
  const entity = ENTITY_LABELS[entityType] ?? entityType.toLowerCase()
  return `${userName} ${phrase} ${entity}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  logs: ActivityEntry[]
}

export function ActivityFeed({ logs }: ActivityFeedProps) {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-[#49426E]" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent Activity</h3>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Activity className="w-7 h-7 text-slate-200 mb-2" />
          <p className="text-xs font-medium text-muted-foreground">No recent activity</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {logs.map((log, i) => (
            <div key={log.id} className={cn("flex items-start gap-3 px-4 py-3", i % 2 === 1 && "bg-[#FAFAFA]")}>
              {/* Dot */}
              <div className="flex flex-col items-center pt-1 shrink-0">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  ACTION_COLORS[log.action] ?? "bg-slate-300"
                )} />
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#322E53] font-medium leading-snug">
                  {formatLog(log.action, log.entityType, log.userName)}
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
