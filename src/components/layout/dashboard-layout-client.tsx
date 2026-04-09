"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "./sidebar"
import { Topbar  } from "./topbar"
import { CommandPalette } from "./command-palette"
import type { Role } from "@/types"

interface DashboardLayoutClientProps {
  children:   React.ReactNode
  userName:   string
  userEmail:  string
  userRole:   string
}

export function DashboardLayoutClient({
  children,
  userName,
  userEmail,
  userRole,
}: DashboardLayoutClientProps) {
  const [sidebarOpen,      setSidebarOpen]      = useState(false)
  const [cmdPaletteOpen,   setCmdPaletteOpen]   = useState(false)

  // Global Cmd+K / Ctrl+K handler
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setCmdPaletteOpen((v) => !v)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-brand-bg">
      {/* ── Mobile overlay ──────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        userRole={userRole}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          pageTitle="Flexi Time"
          userName={userName}
          userEmail={userEmail}
          userRole={userRole}
          onMenuClick={() => setSidebarOpen(true)}
          onSearchClick={() => setCmdPaletteOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-6 bg-brand-bg">
          {children}
        </main>
      </div>

      {/* ── Command palette ──────────────────────────────────────────────────── */}
      <CommandPalette
        open={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        role={userRole as Role}
      />
    </div>
  )
}
