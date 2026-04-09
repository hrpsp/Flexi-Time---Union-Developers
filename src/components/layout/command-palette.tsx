"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import {
  Search, LayoutDashboard, Users, UserCheck, Clock,
  BarChart3, Settings, X, Loader2, ArrowRight,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { hasPermission, type Permission } from "@/lib/rbac"
import type { Role } from "@/types"

// ─────────────────────────────────────────────────────────────────────────────
// Navigation items
// ─────────────────────────────────────────────────────────────────────────────

interface NavOption {
  label:       string
  href:        string
  icon:        React.ElementType
  permission?: Permission
  keywords:    string[]
}

const NAV_OPTIONS: NavOption[] = [
  { label: "Dashboard",  href: "/dashboard",  icon: LayoutDashboard, keywords: ["home", "overview"] },
  { label: "Users",      href: "/users",      icon: Users,     permission: "users:read",       keywords: ["accounts", "admins"] },
  { label: "Employees",  href: "/employees",  icon: UserCheck, permission: "employees:read",   keywords: ["staff", "people"] },
  { label: "Attendance", href: "/attendance", icon: Clock,     permission: "attendance:read",  keywords: ["grid", "periods"] },
  { label: "Reports",    href: "/reports",    icon: BarChart3, permission: "reports:read",     keywords: ["export", "summary"] },
  { label: "Settings",   href: "/settings",   icon: Settings,  permission: "settings:manage",  keywords: ["shift", "config"] },
]

// ─────────────────────────────────────────────────────────────────────────────
// Employee search result
// ─────────────────────────────────────────────────────────────────────────────

interface EmpResult {
  id:          string
  hcmId:       string
  name:        string
  designation: string | null
  status:      string
  department:  { name: string } | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Palette
// ─────────────────────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  open:    boolean
  onClose: () => void
  role:    Role | string
}

export function CommandPalette({ open, onClose, role }: CommandPaletteProps) {
  const router      = useRouter()
  const inputRef    = useRef<HTMLInputElement>(null)
  const [query,     setQuery]    = useState("")
  const [employees, setEmployees] = useState<EmpResult[]>([])
  const [loading,   setLoading]  = useState(false)
  const [cursor,    setCursor]   = useState(0)

  // Filter nav items by role + query
  const navItems = NAV_OPTIONS.filter((n) =>
    (!n.permission || hasPermission(role as Role, n.permission)) &&
    (!query || [n.label, ...n.keywords].some((k) => k.toLowerCase().includes(query.toLowerCase())))
  )

  // Search employees (debounced)
  const searchEmployees = useCallback(async (q: string) => {
    if (!q || q.length < 1) { setEmployees([]); return }
    setLoading(true)
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (res.ok) setEmployees(data.employees ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchEmployees(query), 250)
    return () => clearTimeout(t)
  }, [query, searchEmployees])

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("")
      setEmployees([])
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const totalItems = navItems.length + employees.length

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, totalItems - 1)) }
      if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
      if (e.key === "Enter") {
        e.preventDefault()
        if (cursor < navItems.length) {
          router.push(navItems[cursor].href)
          onClose()
        } else {
          const emp = employees[cursor - navItems.length]
          if (emp) { router.push(`/employees/${emp.id}`); onClose() }
        }
      }
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, cursor, navItems, employees, router, onClose, totalItems])

  function navigate(href: string) {
    router.push(href)
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-[20vh] z-50 -translate-x-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl shadow-[#322E53]/20 border border-border overflow-hidden
                     data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
                     data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
                     data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2
                     data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%]"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>

          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setCursor(0) }}
              placeholder="Search pages or employees…"
              className="flex-1 text-sm bg-transparent outline-none text-[#322E53] font-medium placeholder-slate-400"
            />
            {loading && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />}
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-[#322E53] hover:bg-[#F5F4F8] transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {/* Navigation section */}
            {navItems.length > 0 && (
              <div>
                {!query && (
                  <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Navigate</p>
                )}
                {navItems.map((item, i) => (
                  <button
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    className={cn(
                      "flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors",
                      cursor === i ? "bg-[#322E53] text-white" : "text-[#322E53] hover:bg-[#F5F4F8]"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                      cursor === i ? "bg-white/15" : "bg-[#F5F4F8]"
                    )}>
                      <item.icon className={cn("w-3.5 h-3.5", cursor === i ? "text-[#EEC293]" : "text-[#49426E]")} />
                    </div>
                    <span className="text-sm font-semibold">{item.label}</span>
                    <ArrowRight className={cn("w-3.5 h-3.5 ml-auto shrink-0", cursor === i ? "text-white/50" : "text-slate-300")} />
                  </button>
                ))}
              </div>
            )}

            {/* Employees section */}
            {employees.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Employees</p>
                {employees.map((emp, i) => {
                  const idx = navItems.length + i
                  return (
                    <button
                      key={emp.id}
                      onClick={() => navigate(`/employees/${emp.id}`)}
                      className={cn(
                        "flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors",
                        cursor === idx ? "bg-[#322E53] text-white" : "text-[#322E53] hover:bg-[#F5F4F8]"
                      )}
                    >
                      {/* Avatar */}
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                        cursor === idx ? "bg-white/20 text-white" : "bg-[#322E53] text-[#EEC293]"
                      )}>
                        {emp.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-semibold truncate", cursor === idx ? "text-white" : "text-[#322E53]")}>
                          {emp.name}
                        </p>
                        <p className={cn("text-[11px] truncate", cursor === idx ? "text-white/60" : "text-slate-400")}>
                          {emp.hcmId} · {emp.department?.name ?? "—"}
                        </p>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0",
                        emp.status === "ACTIVE"
                          ? cursor === idx ? "bg-emerald-400/20 text-emerald-200" : "bg-emerald-50 text-emerald-700"
                          : cursor === idx ? "bg-red-400/20 text-red-200" : "bg-red-50 text-red-600"
                      )}>
                        {emp.status}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Empty state */}
            {query && navItems.length === 0 && employees.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Search className="w-7 h-7 text-slate-200 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border bg-[#F5F4F8]">
            <span className="text-[10px] text-slate-400 font-medium">
              <kbd className="px-1 py-0.5 rounded bg-white border border-border font-mono">↑↓</kbd>{" "}navigate
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              <kbd className="px-1 py-0.5 rounded bg-white border border-border font-mono">↵</kbd>{" "}open
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              <kbd className="px-1 py-0.5 rounded bg-white border border-border font-mono">Esc</kbd>{" "}close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
