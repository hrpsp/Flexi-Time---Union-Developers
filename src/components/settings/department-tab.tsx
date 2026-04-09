"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, PowerOff, Power, Loader2, X, Building2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable }     from "@/components/shared/data-table"
import type { Column }   from "@/components/shared/data-table"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Department {
  id:        string
  code:      number
  name:      string
  isActive:  boolean
  employees: number
  createdAt: string
}

type DeptRow = Record<string, unknown> & Department

// ─────────────────────────────────────────────────────────────────────────────
// Dept Modal (Add / Edit)
// ─────────────────────────────────────────────────────────────────────────────

function DeptModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open:    boolean
  editing: Department | null
  onClose: () => void
  onSaved: (dept: Department) => void
}) {
  const [code,   setCode]   = useState("")
  const [name,   setName]   = useState("")
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState("")

  useEffect(() => {
    if (open) {
      setError("")
      setCode(editing ? String(editing.code) : "")
      setName(editing ? editing.name : "")
    }
  }, [open, editing])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      const url    = editing ? `/api/settings/departments/${editing.id}` : "/api/settings/departments"
      const method = editing ? "PATCH" : "POST"
      const body   = editing
        ? { name }
        : { code: Number(code), name }

      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to save department.")
        return
      }
      toast.success(editing ? "Department updated." : "Department created.")
      onSaved(data.department)
      onClose()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const fieldCls = "w-full px-3 py-2 text-sm bg-white border border-border rounded-xl text-[#322E53] font-medium outline-none focus:border-[#322E53] transition-colors"
  const labelCls = "block text-xs font-bold text-[#49426E] uppercase tracking-wider mb-1.5"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl shadow-[#322E53]/20 border border-border w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <h3 className="text-base font-bold text-[#322E53]">
            {editing ? "Rename Department" : "Add Department"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#322E53] hover:bg-[#F5F4F8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Code — only for add */}
          {!editing && (
            <div>
              <label className={labelCls}>Department Code</label>
              <input
                type="number"
                min={1}
                max={9999}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 101"
                className={fieldCls}
                required
              />
              <p className="text-[11px] text-slate-400 font-medium mt-1">Unique numeric code — cannot be changed later.</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className={labelCls}>Department Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Information Technology"
              className={fieldCls}
              required
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 px-4 rounded-xl border border-border text-sm font-semibold text-[#322E53] hover:bg-[#F5F4F8] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#322E53] text-white text-sm font-bold hover:bg-[#49426E] transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editing ? "Save Name" : "Add Department"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Department Tab
// ─────────────────────────────────────────────────────────────────────────────

export function DepartmentTab() {
  const [depts,         setDepts]         = useState<Department[]>([])
  const [loading,       setLoading]       = useState(true)
  const [showModal,     setShowModal]     = useState(false)
  const [editing,       setEditing]       = useState<Department | null>(null)
  const [toggleTarget,  setToggleTarget]  = useState<Department | null>(null)
  const [toggling,      setToggling]      = useState(false)

  const fetchDepts = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/settings/departments")
      const data = await res.json()
      if (res.ok) setDepts(data.departments)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDepts() }, [fetchDepts])

  function openAdd() { setEditing(null); setShowModal(true) }
  function openEdit(dept: Department) { setEditing(dept); setShowModal(true) }

  function handleSaved(saved: Department) {
    setDepts((prev) => {
      const idx = prev.findIndex((d) => d.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [saved, ...prev]
    })
  }

  async function handleToggle() {
    if (!toggleTarget) return
    setToggling(true)
    const action = toggleTarget.isActive ? "deactivate" : "activate"
    try {
      const res  = await fetch(`/api/settings/departments/${toggleTarget.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed."); return }
      setDepts((prev) => prev.map((d) => d.id === data.department.id ? data.department : d))
      toast.success(`Department ${action}d.`)
      setToggleTarget(null)
    } finally {
      setToggling(false)
    }
  }

  // Build table rows as Record<string, unknown>
  const tableData: DeptRow[] = depts.map((d) => ({ ...d } as DeptRow))

  const columns: Column<DeptRow>[] = [
    {
      key:      "code",
      header:   "Code",
      sortable: true,
      width:    "80px",
      render:   (v) => (
        <span className="font-mono text-xs font-bold text-[#49426E]">{String(v)}</span>
      ),
    },
    {
      key:      "name",
      header:   "Name",
      sortable: true,
      render:   (v, row) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#322E53]">{String(v)}</span>
          {!row.isActive && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">
              Inactive
            </span>
          )}
        </div>
      ),
    },
    {
      key:      "employees",
      header:   "Employees",
      sortable: true,
      width:    "110px",
      className: "text-center",
      render:   (v) => (
        <span className={cn(
          "inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold",
          Number(v) > 0
            ? "bg-[#322E53]/10 text-[#322E53]"
            : "bg-slate-100 text-slate-400"
        )}>
          {String(v)}
        </span>
      ),
    },
    {
      key:      "isActive",
      header:   "Status",
      sortable: true,
      width:    "100px",
      render:   (v) => (
        <span className={cn(
          "inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border",
          v
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-slate-100 text-slate-500 border-slate-200"
        )}>
          {v ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key:    "actions",
      header: "",
      width:  "90px",
      render: (_, row) => (
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(row as Department) }}
            title="Rename"
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#322E53] hover:bg-[#F5F4F8] transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setToggleTarget(row as Department) }}
            title={row.isActive ? "Deactivate" : "Reactivate"}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              row.isActive
                ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
                : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
            )}
          >
            {row.isActive
              ? <PowerOff className="w-3.5 h-3.5" />
              : <Power     className="w-3.5 h-3.5" />}
          </button>
        </div>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[#322E53]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-[#322E53]">Departments</h3>
          <p className="text-sm text-muted-foreground font-medium mt-0.5">
            Departments with linked employees cannot be deleted — deactivate instead.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#322E53] text-white text-sm font-bold hover:bg-[#49426E] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Department
        </button>
      </div>

      {/* Table */}
      {depts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-border text-center">
          <Building2 className="w-9 h-9 text-[#EEC293] mb-3" />
          <p className="font-bold text-[#322E53]">No departments yet</p>
          <p className="text-sm text-muted-foreground font-medium mt-1">Add your first department to get started.</p>
          <button
            onClick={openAdd}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#322E53] text-white text-sm font-bold hover:bg-[#49426E] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Department
          </button>
        </div>
      ) : (
        <DataTable
          data={tableData}
          columns={columns}
          searchable
          searchKeys={["name", "code"]}
          pageSize={20}
          emptyText="No departments match your search."
        />
      )}

      {/* Modals */}
      <DeptModal
        open={showModal}
        editing={editing}
        onClose={() => setShowModal(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        loading={toggling}
        variant={toggleTarget?.isActive ? "danger" : "default"}
        title={
          toggleTarget?.isActive
            ? `Deactivate "${toggleTarget?.name}"?`
            : `Reactivate "${toggleTarget?.name}"?`
        }
        description={
          toggleTarget?.isActive
            ? `This department will be marked as inactive. It will still be visible on existing employee records but won't appear in new assignment dropdowns.`
            : `This department will be marked as active and available for employee assignments.`
        }
        confirmLabel={toggleTarget?.isActive ? "Deactivate" : "Reactivate"}
      />
    </div>
  )
}
