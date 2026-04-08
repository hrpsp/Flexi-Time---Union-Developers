"use client"

import { Menu, Bell, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

interface TopbarProps {
  title:          string
  activePeriod?:  string | null
  onMenuToggle?:  () => void
}

export function Topbar({ title, activePeriod, onMenuToggle }: TopbarProps) {
  return (
    <header className="flex items-center gap-4 px-5 h-[var(--topbar-height)] border-b border-[hsl(var(--sidebar-border))] bg-background/80 backdrop-blur-sm sticky top-0 z-10">

      {/* Mobile menu toggle */}
      {onMenuToggle && (
        <button
          onClick={onMenuToggle}
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Title */}
      <h1 className="text-sm font-semibold text-white flex-1 truncate">{title}</h1>

      {/* Active period badge */}
      {activePeriod && (
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600/15 border border-indigo-600/25 text-xs font-medium text-indigo-400">
          <Calendar className="w-3 h-3" />
          {activePeriod}
        </div>
      )}

      {/* Notification bell — placeholder for Phase 5 */}
      <button
        className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors relative"
        title="Notifications"
      >
        <Bell className="w-4.5 h-4.5 w-[18px] h-[18px]" />
      </button>
    </header>
  )
}
