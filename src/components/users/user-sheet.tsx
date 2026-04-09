"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { X, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  createUserSchema, editUserSchema,
  ROLES,
  type CreateUserInput, type EditUserInput,
} from "@/lib/validations/users"
import { ROLE_CONFIG } from "@/components/users/role-badge"
import type { Role } from "@/types"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UserRow {
  id:        string
  name:      string
  email:     string
  role:      Role
  isActive:  boolean
  createdAt: string
}

interface UserSheetProps {
  open:    boolean
  onClose: () => void
  onSaved: (user: UserRow) => void
  editing?: UserRow | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Field helpers
// ─────────────────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-500 font-medium">
      <AlertCircle className="w-3 h-3 shrink-0" />
      {message}
    </p>
  )
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-border bg-brand-bg " +
  "text-sm font-medium text-brand-purple placeholder-slate-400 " +
  "focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple " +
  "transition-colors disabled:opacity-50"

// ─────────────────────────────────────────────────────────────────────────────
// Sheet
// ─────────────────────────────────────────────────────────────────────────────

export function UserSheet({ open, onClose, onSaved, editing }: UserSheetProps) {
  const isEdit = !!editing
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)

  // Create form
  const createForm = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", role: "VIEWER", password: "" },
  })

  // Edit form
  const editForm = useForm<EditUserInput>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { name: editing?.name ?? "", role: editing?.role ?? "VIEWER" },
  })

  // Reset forms when sheet opens/closes or editing target changes
  useEffect(() => {
    if (open) {
      if (isEdit && editing) {
        editForm.reset({ name: editing.name, role: editing.role })
      } else {
        createForm.reset({ name: "", email: "", role: "VIEWER", password: "" })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id])

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleCreate = async (data: CreateUserInput) => {
    setLoading(true)
    try {
      const res = await fetch("/api/users", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      })
      const body = await res.json()
      if (!res.ok) {
        const msg = body.error?.formErrors?.[0] ?? body.error ?? "Something went wrong."
        toast.error(msg)
        return
      }
      toast.success(`User "${body.user.name}" created.`)
      onSaved(body.user)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (data: EditUserInput) => {
    if (!editing) return
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${editing.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body.error ?? "Something went wrong.")
        return
      }
      toast.success(`User "${body.user.name}" updated.`)
      onSaved(body.user)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* ── Sheet panel ───────────────────────────────────────────────────── */}
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-[460px] bg-white shadow-2xl shadow-brand-purple/20 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-extrabold text-brand-purple">
              {isEdit ? "Edit User" : "Add New User"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              {isEdit
                ? "Update name and role. Use Reset Password to change credentials."
                : "Create a new system user account."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-brand-bg transition-colors text-slate-400 hover:text-brand-purple"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">

          {isEdit ? (
            /* ── EDIT FORM ─────────────────────────────────────────────── */
            <form id="user-form" onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-5" noValidate>

              {/* Email (read-only) */}
              <div>
                <Label>Email Address</Label>
                <input
                  type="email"
                  value={editing?.email}
                  disabled
                  className={inputCls + " cursor-not-allowed"}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Email cannot be changed.</p>
              </div>

              {/* Name */}
              <div>
                <Label required>Full Name</Label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Ahmed"
                  {...editForm.register("name")}
                  className={inputCls}
                />
                <FieldError message={editForm.formState.errors.name?.message} />
              </div>

              {/* Role */}
              <div>
                <Label required>Role</Label>
                <select {...editForm.register("role")} className={inputCls}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_CONFIG[r as Role]?.label ?? r}</option>
                  ))}
                </select>
                <FieldError message={editForm.formState.errors.role?.message} />
              </div>
            </form>
          ) : (
            /* ── CREATE FORM ───────────────────────────────────────────── */
            <form id="user-form" onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-5" noValidate>

              {/* Name */}
              <div>
                <Label required>Full Name</Label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Ahmed"
                  {...createForm.register("name")}
                  className={inputCls}
                />
                <FieldError message={createForm.formState.errors.name?.message} />
              </div>

              {/* Email */}
              <div>
                <Label required>Email Address</Label>
                <input
                  type="email"
                  placeholder="user@flexiit.com"
                  {...createForm.register("email")}
                  className={inputCls}
                />
                <FieldError message={createForm.formState.errors.email?.message} />
              </div>

              {/* Role */}
              <div>
                <Label required>Role</Label>
                <select {...createForm.register("role")} className={inputCls}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_CONFIG[r as Role]?.label ?? r}</option>
                  ))}
                </select>
                <FieldError message={createForm.formState.errors.role?.message} />
              </div>

              {/* Password */}
              <div>
                <Label required>Password</Label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    {...createForm.register("password")}
                    className={inputCls + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-purple transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <FieldError message={createForm.formState.errors.password?.message} />
              </div>
            </form>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-border flex items-center gap-3 shrink-0 bg-brand-bg/50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold text-brand-purple hover:bg-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-purple hover:bg-brand-mid-purple text-white text-sm font-bold transition-colors disabled:opacity-60 shadow-md shadow-brand-purple/25"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {loading ? "Saving…" : isEdit ? "Save Changes" : "Create User"}
          </button>
        </div>
      </div>
    </>
  )
}
