"use client"

import { AlertTriangle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
  open:       boolean
  onClose:    () => void
  onConfirm:  () => void | Promise<void>
  title:      string
  description?: string
  confirmLabel?: string
  cancelLabel?:  string
  variant?:   "danger" | "default"
  loading?:   boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel  = "Cancel",
  variant      = "default",
  loading      = false,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl shadow-[#322E53]/20 border border-border w-full max-w-sm p-6">
        {/* Icon */}
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center mb-4",
          variant === "danger" ? "bg-red-50" : "bg-[#F5F4F8]"
        )}>
          <AlertTriangle className={cn(
            "w-6 h-6",
            variant === "danger" ? "text-red-500" : "text-[#322E53]"
          )} />
        </div>

        {/* Content */}
        <h3 className="text-base font-bold text-[#322E53] mb-1.5">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground font-medium">{description}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-lg border border-border text-sm font-semibold
                       text-[#322E53] hover:bg-[#F5F4F8] transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-colors disabled:opacity-50",
              variant === "danger"
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-[#322E53] hover:bg-[#49426E] text-white"
            )}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
