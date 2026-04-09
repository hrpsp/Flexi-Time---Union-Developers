"use client"

import { useState } from "react"
import { Clock, Building2, Mail, Server } from "lucide-react"
import { cn } from "@/lib/utils"
import { ShiftTab }      from "./shift-tab"
import { DepartmentTab } from "./department-tab"
import { EmailTab }      from "./email-tab"
import { SystemInfoTab } from "./system-info-tab"

// ─────────────────────────────────────────────────────────────────────────────
// Tab config
// ─────────────────────────────────────────────────────────────────────────────

type TabId = "shifts" | "departments" | "email-templates" | "system-info"

interface TabDef {
  id:          TabId
  label:       string
  description: string
  icon:        React.ElementType
}

const TABS: TabDef[] = [
  {
    id:          "shifts",
    label:       "Shift Configuration",
    description: "Manage shift profiles and attendance thresholds",
    icon:        Clock,
  },
  {
    id:          "departments",
    label:       "Departments",
    description: "Add, rename, and activate/deactivate departments",
    icon:        Building2,
  },
  {
    id:          "email-templates",
    label:       "Email Templates",
    description: "Customize automated email content",
    icon:        Mail,
  },
  {
    id:          "system-info",
    label:       "System Info",
    description: "App version, DB status, and diagnostics",
    icon:        Server,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Settings Shell
// ─────────────────────────────────────────────────────────────────────────────

export function SettingsShell() {
  const [activeTab, setActiveTab] = useState<TabId>("shifts")

  return (
    <div className="flex gap-6 min-h-[calc(100vh-160px)]">
      {/* ── Left nav panel ─────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0">
        <nav className="flex flex-col gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "group flex items-start gap-3 w-full px-4 py-3.5 rounded-2xl text-left transition-all",
                  isActive
                    ? "bg-[#322E53] shadow-sm shadow-[#322E53]/20"
                    : "hover:bg-white border border-transparent hover:border-border"
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                  isActive ? "bg-white/15" : "bg-[#F5F4F8] group-hover:bg-[#E8E6EF]"
                )}>
                  <tab.icon className={cn(
                    "w-4 h-4 transition-colors",
                    isActive ? "text-white" : "text-[#49426E]"
                  )} />
                </div>

                {/* Text */}
                <div className="min-w-0">
                  <p className={cn(
                    "text-sm font-bold leading-tight",
                    isActive ? "text-white" : "text-[#322E53]"
                  )}>
                    {tab.label}
                  </p>
                  <p className={cn(
                    "text-[11px] font-medium leading-snug mt-0.5",
                    isActive ? "text-white/60" : "text-slate-400"
                  )}>
                    {tab.description}
                  </p>
                </div>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* ── Content panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {activeTab === "shifts"           && <ShiftTab />}
        {activeTab === "departments"      && <DepartmentTab />}
        {activeTab === "email-templates"  && <EmailTab />}
        {activeTab === "system-info"      && <SystemInfoTab />}
      </div>
    </div>
  )
}
