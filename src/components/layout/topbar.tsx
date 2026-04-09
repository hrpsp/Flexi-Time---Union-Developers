"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { Bell, Search, ChevronDown, LogOut, User, Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Role } from "@/types"

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN:  "Super Admin",
  ADMIN:        "Admin",
  HR_MANAGER:   "HR Manager",
  HR_EXECUTIVE: "HR Executive",
  VIEWER:       "Viewer",
}

interface TopbarProps {
  pageTitle:     string
  userName:      string
  userEmail:     string
  userRole:      Role | string
  onMenuClick?:  () => void
  onSearchClick?: () => void
}

export function Topbar({ pageTitle, userName, userEmail, userRole, onMenuClick, onSearchClick }: TopbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const initials = userName
    .split(" ")
    .map((n) => n[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const roleLabel = ROLE_LABELS[userRole as Role] ?? userRole

  return (
    <header
      className="flex items-center gap-4 px-4 md:px-6 bg-white border-b border-border sticky top-0 z-10 shrink-0"
      style={{ height: "var(--topbar-height)" }}
    >
      {/* Hamburger — mobile only */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg text-slate-500 hover:text-brand-purple hover:bg-brand-bg transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Page title */}
      <h1 className="text-base font-bold text-brand-purple flex-1 truncate">
        {pageTitle}
      </h1>

      {/* Search — opens command palette */}
      <button
        onClick={onSearchClick}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-bg border border-border text-sm text-muted-foreground w-52 hover:border-[#322E53]/30 transition-colors"
      >
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="text-xs">Search…</span>
        <kbd className="ml-auto hidden lg:inline-flex h-4 select-none items-center gap-0.5 rounded border bg-white px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Notifications */}
      <button className="relative p-2 rounded-lg hover:bg-brand-bg transition-colors text-slate-500 hover:text-brand-purple">
        <Bell className="w-[18px] h-[18px]" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-salmon" />
      </button>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-brand-bg transition-colors"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: "#322E53", color: "#EEC293" }}
          >
            {initials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-brand-purple leading-tight">{userName}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{roleLabel}</p>
          </div>
          <ChevronDown className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform",
            dropdownOpen && "rotate-180"
          )} />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
            <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-52 bg-white rounded-xl border border-border shadow-lg shadow-brand-purple/10 py-1.5 overflow-hidden">
              {/* User info */}
              <div className="px-4 py-2.5 border-b border-border">
                <p className="text-xs font-bold text-brand-purple">{userName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
                <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-bg text-brand-mid-purple uppercase tracking-wide">
                  {roleLabel}
                </span>
              </div>

              <button className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-brand-bg hover:text-brand-purple transition-colors font-medium">
                <User className="w-4 h-4" />
                My Profile
              </button>

              <div className="border-t border-border mt-1 pt-1">
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
