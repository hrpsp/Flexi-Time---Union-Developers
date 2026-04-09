"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { X, Loader2, Eye, EyeOff, AlertCircle, KeyRound } from "lucide-react"
import { toast } from "sonner"
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/users"

interface ResetPasswordDialogProps {
  open:     boolean
  onClose:  () => void
  userId:   string
  userName: string
}

const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-border bg-brand-bg " +
  "text-sm font-medium text-brand-purple placeholder-slate-400 " +
  "focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple " +
  "transition-colors"

export function ResetPasswordDialog({ open, onClose, userId, userName }: ResetPasswordDialogProps) {
  const [showPass,    setShowPass]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = async (data: ResetPasswordInput) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/users/${userId}/reset-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body.error ?? "Failed to reset password.")
        return
      }
      toast.success(`Password reset for ${userName}.`)
      reset()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl shadow-brand-purple/20 border border-border w-full max-w-[400px]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <KeyRound className="w-4.5 h-4.5 w-[18px] h-[18px] text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-brand-purple">Reset Password</h3>
              <p className="text-[11px] text-muted-foreground">{userName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-purple hover:bg-brand-bg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4" noValidate>

          {/* New password */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
              New Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                {...register("password")}
                className={inputCls + " pr-10"}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-purple"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />{errors.password.message}
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#49426E] mb-1.5">
              Confirm Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter new password"
                {...register("confirmPassword")}
                className={inputCls + " pr-10"}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-purple"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />{errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold text-brand-purple hover:bg-brand-bg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors disabled:opacity-60"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? "Saving…" : "Reset Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
