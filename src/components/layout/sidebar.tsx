"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Clock,
  BarChart3,
  Clock4,
  ChevronRight,
  Settings,
  LogOut,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { hasPermission, type Permission, NAV_PERMISSIONS } from "@/lib/rbac"
import type { Role } from "@/types"

// ─────────────────────────────────────────────────────────────────────────────
// NAV CONFIG
// ─────────────────────────────────────────────────────────────────────────────

interface NavItem {
  href:        string
  label:       string
  icon:        React.ElementType
  permission?: Permission   // undefined = visible to all authenticated users
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { href: "/users",      label: "Users",       icon: Users,      permission: "users:read"       },
  { href: "/employees",  label: "Employees",   icon: UserCheck,  permission: "employees:read"   },
  { href: "/attendance", label: "Attendance",  icon: Clock,      permission: "attendance:read"  },
  { href: "/reports",    label: "Reports",     icon: BarChart3,  permission: "reports:read"     },
]

const BOTTOM_ITEMS: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings, permission: "settings:manage" },
]

// ─────────────────────────────────────────────────────────────────────────────
// ROLE LABELS
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN:  "Super Admin",
  ADMIN:        "Admin",
  HR_MANAGER:   "HR Manager",
  HR_EXECUTIVE: "HR Executive",
  VIEWER:       "Viewer",
}

const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN:  "bg-brand-peach/20 text-brand-peach",
  ADMIN:        "bg-white/15 text-white/80",
  HR_MANAGER:   "bg-emerald-500/20 text-emerald-300",
  HR_EXECUTIVE: "bg-blue-500/20 text-blue-300",
  VIEWER:       "bg-white/10 text-white/50",
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarProps {
  userName:      string
  userEmail:     string
  userRole:      Role | string
  mobileOpen?:   boolean
  onMobileClose?: () => void
}

export function Sidebar({ userName, userEmail, userRole, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const role     = userRole as Role

  const isActive  = (href: string) => pathname === href || pathname.startsWith(href + "/")
  const canSee    = (item: NavItem) =>
    !item.permission || hasPermission(role, item.permission)

  const visibleMain   = NAV_ITEMS.filter(canSee)
  const visibleBottom = BOTTOM_ITEMS.filter(canSee)

  const initials = userName
    .split(" ")
    .map((n) => n[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <aside
      className={cn(
        "flex flex-col h-full shrink-0 transition-transform duration-300 ease-in-out",
        // Desktop: always visible, static
        "md:relative md:translate-x-0",
        // Mobile: fixed drawer that slides in/out
        "fixed inset-y-0 left-0 z-30 md:static",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
      style={{ width: "var(--sidebar-width)", background: "#322E53" }}
    >
      {/* ── Wordmark ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-5 border-b border-white/10 shrink-0"
        style={{ height: "var(--topbar-height)" }}
      >
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 shrink-0">
          <Clock4 className="w-5 h-5 text-brand-peach" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xl font-extrabold tracking-tight leading-none text-brand-peach">
            Flexi Time
          </span>
          <p className="text-[10px] text-white/40 font-medium leading-tight mt-0.5">
            by Flexi IT Services
          </p>
        </div>
        {/* Mobile close button */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Main nav ──────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-0.5">
        <p className="px-7 mb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
          Menu
        </p>

        {visibleMain.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "nav-item",
                active && "nav-item-active"
              )}
            >
              <Icon
                className="w-[18px] h-[18px] shrink-0"
                style={{ color: active ? "#EEC293" : "rgba(255,255,255,0.5)" }}
              />
              <span className={cn(
                "flex-1 text-sm",
                active ? "text-white font-semibold" : "text-white/65 font-medium"
              )}>
                {label}
              </span>
              {active && <ChevronRight className="w-3.5 h-3.5 text-brand-peach/60" />}
            </Link>
          )
        })}
      </nav>

      {/* ── Bottom items ──────────────────────────────────────────────────── */}
      {visibleBottom.length > 0 && (
        <div className="pb-2 border-t border-white/10 pt-2 space-y-0.5">
          {visibleBottom.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn("nav-item", active && "nav-item-active")}
              >
                <Icon
                  className="w-[18px] h-[18px] shrink-0"
                  style={{ color: active ? "#EEC293" : "rgba(255,255,255,0.5)" }}
                />
                <span className={cn(
                  "flex-1 text-sm",
                  active ? "text-white font-semibold" : "text-white/65 font-medium"
                )}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── User footer ───────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-white/10 shrink-0">
        {/* Role badge */}
        <div className="px-3 mb-2">
          <span className={cn(
            "inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
            ROLE_COLORS[role] ?? "bg-white/10 text-white/60"
          )}>
            {ROLE_LABELS[role] ?? role}
          </span>
        </div>

        {/* User row */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
            style={{ background: "#EEC293", color: "#322E53" }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{userName}</p>
            <p className="text-[10px] text-white/40 truncate">{userEmail}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
