"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  Search, Plus, ChevronLeft, ChevronRight,
  Pencil, KeyRound, UserX, UserCheck, ChevronsUpDown,
  ChevronUp, ChevronDown, Users,
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ROLES } from "@/lib/validations/users"
import { ROLE_CONFIG } from "@/components/users/role-badge"
import { RoleBadge } from "@/components/users/role-badge"
import { UserSheet, type UserRow } from "@/components/users/user-sheet"
import { ResetPasswordDialog } from "@/components/users/reset-password-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useDebounce } from "@/hooks/use-debounce"
import type { Role } from "@/types"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SortKey = "name" | "email" | "role" | "createdAt"
type SortDir = "asc" | "desc"

interface UserTableState {
  users:   UserRow[]
  total:   number
  page:    number
  pages:   number
  loading: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function UserTable() {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id

  // ── Filter state ────────────────────────────────────────────────────────────
  const [search, setSearch]     = useState("")
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL")
  const [page, setPage]         = useState(1)
  const [sortKey, setSortKey]   = useState<SortKey>("createdAt")
  const [sortDir, setSortDir]   = useState<SortDir>("desc")

  const debouncedSearch = useDebounce(search, 300)

  // ── Data state ──────────────────────────────────────────────────────────────
  const [state, setState] = useState<UserTableState>({
    users: [], total: 0, page: 1, pages: 1, loading: true,
  })

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [sheet, setSheet]               = useState<{ open: boolean; user?: UserRow }>({ open: false })
  const [resetDialog, setResetDialog]   = useState<{ open: boolean; user?: UserRow }>({ open: false })
  const [confirmToggle, setConfirmToggle] = useState<{ open: boolean; user?: UserRow }>({ open: false })
  const [toggleLoading, setToggleLoading] = useState(false)

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    const params = new URLSearchParams({
      search: debouncedSearch,
      role:   roleFilter,
      page:   String(page),
      limit:  "15",
    })
    try {
      const res  = await fetch(`/api/users?${params}`)
      const body = await res.json()
      if (!res.ok) { toast.error("Failed to load users."); return }
      setState({ users: body.users, total: body.total, page: body.page, pages: body.pages, loading: false })
    } catch {
      toast.error("Network error.")
      setState((s) => ({ ...s, loading: false }))
    }
  }, [debouncedSearch, roleFilter, page])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // Client-side sort (data already paginated from server)
  const sorted = [...state.users].sort((a, b) => {
    const av = a[sortKey] ?? ""
    const bv = b[sortKey] ?? ""
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
    return sortDir === "asc" ? cmp : -cmp
  })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  // ── Deactivate / Activate ───────────────────────────────────────────────────
  const handleToggleActive = async () => {
    const user = confirmToggle.user
    if (!user) return
    setToggleLoading(true)
    try {
      const res  = await fetch(`/api/users/${user.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ isActive: !user.isActive }),
      })
      const body = await res.json()
      if (!res.ok) { toast.error(body.error ?? "Failed."); return }
      toast.success(`${user.name} ${user.isActive ? "deactivated" : "activated"}.`)
      setConfirmToggle({ open: false })
      fetchUsers()
    } finally {
      setToggleLoading(false)
    }
  }

  const handleSaved = () => { setSheet({ open: false }); fetchUsers() }

  // ── Sorting icon ────────────────────────────────────────────────────────────
  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? sortDir === "asc"
        ? <ChevronUp   className="w-3 h-3 text-brand-purple" />
        : <ChevronDown className="w-3 h-3 text-brand-purple" />
      : <ChevronsUpDown className="w-3 h-3 text-slate-300" />

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-4">

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Search */}
          <div className="flex items-center gap-2 px-3.5 py-2 bg-white rounded-xl border border-border flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search name or email…"
              className="flex-1 text-sm bg-transparent outline-none text-brand-purple placeholder-slate-400 font-medium"
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value as Role | "ALL"); setPage(1) }}
            className="px-3.5 py-2 bg-white rounded-xl border border-border text-sm font-medium text-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
          >
            <option value="ALL">All Roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_CONFIG[r as Role]?.label ?? r}</option>
            ))}
          </select>

          <div className="flex-1" />

          {/* Add user */}
          <button
            onClick={() => setSheet({ open: true })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors shadow-sm"
            style={{ background: "#EEC293", color: "#322E53" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#e6b580")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#EEC293")}
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>

        {/* ── Table card ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">

              {/* Head */}
              <thead>
                <tr className="border-b border-border bg-brand-bg/70">
                  {(
                    [
                      { key: "name" as SortKey,      label: "Name"    },
                      { key: "email" as SortKey,     label: "Email"   },
                      { key: "role" as SortKey,      label: "Role"    },
                      { key: "createdAt" as SortKey, label: "Created" },
                    ] as { key: SortKey; label: string }[]
                  ).map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-[#49426E] cursor-pointer select-none hover:text-brand-purple"
                    >
                      <div className="flex items-center gap-1.5">
                        {label}
                        <SortIcon col={key} />
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-[#49426E]">
                    Status
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-[#49426E]">
                    Actions
                  </th>
                </tr>
              </thead>

              {/* Body */}
              <tbody>
                {state.loading ? (
                  // Skeleton rows
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border animate-pulse">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-4 bg-slate-100 rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <Users className="w-10 h-10 text-brand-peach mx-auto mb-3" />
                      <p className="font-bold text-brand-purple">No users found</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {search || roleFilter !== "ALL" ? "Try adjusting your filters." : "Add the first user."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  sorted.map((user, i) => (
                    <tr
                      key={user.id}
                      className={cn(
                        "border-b border-border last:border-0 transition-colors hover:bg-brand-bg/40",
                        i % 2 === 1 && "bg-slate-50/50"
                      )}
                    >
                      {/* Name */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                            style={{ background: "#322E53", color: "#EEC293" }}
                          >
                            {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <span className="font-semibold text-brand-purple">
                            {user.name}
                            {user.id === currentUserId && (
                              <span className="ml-2 text-[10px] bg-brand-bg border border-border text-muted-foreground px-1.5 py-0.5 rounded-full font-bold uppercase">
                                You
                              </span>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3.5 text-muted-foreground font-medium">
                        {user.email}
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3.5">
                        <RoleBadge role={user.role} />
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3.5 text-muted-foreground font-medium whitespace-nowrap">
                        {format(new Date(user.createdAt), "dd MMM yyyy")}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide",
                          user.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-500"
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            user.isActive ? "bg-emerald-500" : "bg-red-400"
                          )} />
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit */}
                          <button
                            onClick={() => setSheet({ open: true, user })}
                            title="Edit user"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-purple hover:bg-brand-bg transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset password */}
                          <button
                            onClick={() => setResetDialog({ open: true, user })}
                            title="Reset password"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Activate / Deactivate */}
                          <button
                            onClick={() => setConfirmToggle({ open: true, user })}
                            title={user.isActive ? "Deactivate" : "Activate"}
                            disabled={user.id === currentUserId}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                              user.isActive
                                ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
                                : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                            )}
                          >
                            {user.isActive
                              ? <UserX      className="w-3.5 h-3.5" />
                              : <UserCheck  className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ──────────────────────────────────────────────── */}
          {state.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-brand-bg/40">
              <p className="text-xs text-muted-foreground font-medium">
                {state.total} user{state.total !== 1 ? "s" : ""} · Page {state.page} of {state.pages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={state.page === 1}
                  className="p-1.5 rounded-lg border border-border bg-white hover:bg-brand-bg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft  className="w-4 h-4 text-brand-purple" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(state.pages, p + 1))}
                  disabled={state.page === state.pages}
                  className="p-1.5 rounded-lg border border-border bg-white hover:bg-brand-bg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-brand-purple" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      <UserSheet
        open={sheet.open}
        onClose={() => setSheet({ open: false })}
        onSaved={handleSaved}
        editing={sheet.user}
      />

      {resetDialog.user && (
        <ResetPasswordDialog
          open={resetDialog.open}
          onClose={() => setResetDialog({ open: false })}
          userId={resetDialog.user.id}
          userName={resetDialog.user.name}
        />
      )}

      <ConfirmDialog
        open={confirmToggle.open}
        onClose={() => setConfirmToggle({ open: false })}
        onConfirm={handleToggleActive}
        loading={toggleLoading}
        variant={confirmToggle.user?.isActive ? "danger" : "default"}
        title={
          confirmToggle.user?.isActive
            ? `Deactivate ${confirmToggle.user?.name}?`
            : `Activate ${confirmToggle.user?.name}?`
        }
        description={
          confirmToggle.user?.isActive
            ? "They will lose access immediately and cannot log in until reactivated."
            : "They will regain access to the system."
        }
        confirmLabel={confirmToggle.user?.isActive ? "Deactivate" : "Activate"}
      />
    </>
  )
}
