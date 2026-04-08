"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Clock,
  Users,
  Building2,
  BarChart3,
  Settings,
  ChevronRight,
  LogOut,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import type { Role } from "@prisma/client"

interface NavItem {
  href:     string
  label:    string
  icon:     React.ElementType
  roles?:   Role[]   // undefined = all roles
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { href: "/attendance",  label: "Attendance",  icon: Clock           },
  { href: "/employees",   label: "Employees",   icon: Users           },
  { href: "/departments", label: "Departments", icon: Building2, roles: ["ADMIN", "HR"] },
  { href: "/reports",     label: "Reports",     icon: BarChart3       },
  { href: "/settings",    label: "Settings",    icon: Settings, roles: ["ADMIN"] },
]

interface SidebarProps {
  userRole:  Role
  userName:  string
  userEmail: string
}

export function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const pathname = usePathname()

  const visible = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  )

  return (
    <aside className="flex flex-col h-full bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))] w-[var(--sidebar-width)]">

      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 h-[var(--topbar-height)] border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 shrink-0">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-tight truncate">Union Developers</p>
          <p className="text-[10px] text-slate-500 leading-tight">HR & Attendance</p>
        </div>
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {visible.map((item) => {
          const Icon    = item.icon
          const active  = pathname === item.href || pathname.startsWith(item.href + "/")

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group",
                active
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300")} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 text-indigo-500" />}
            </Link>
          )
        })}
      </nav>

      {/* ── User footer ───────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          {/* Avatar initials */}
          <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">
              {userName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{userName}</p>
            <p className="text-[10px] text-slate-500 truncate">{userEmail}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Role badge */}
        <div className="mt-1.5 px-2">
          <span className={cn(
            "inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
            userRole === "ADMIN"  && "bg-indigo-900/60 text-indigo-400",
            userRole === "HR"     && "bg-emerald-900/60 text-emerald-400",
            userRole === "VIEWER" && "bg-slate-800 text-slate-500",
          )}>
            {userRole}
          </span>
        </div>
      </div>
    </aside>
  )
}
