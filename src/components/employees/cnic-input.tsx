"use client"

import { forwardRef, type InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

// Auto-formats CNIC as user types: XXXXX-XXXXXXX-X
function formatCnic(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13)
  if (digits.length <= 5) return digits
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
}

interface CnicInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value:    string
  onChange: (formatted: string) => void
  error?:   string
}

export const CnicInput = forwardRef<HTMLInputElement, CnicInputProps>(
  function CnicInput({ value, onChange, error, className, ...rest }, ref) {
    return (
      <input
        {...rest}
        ref={ref}
        type="text"
        inputMode="numeric"
        maxLength={15}            // 13 digits + 2 dashes
        placeholder="XXXXX-XXXXXXX-X"
        value={value}
        onChange={(e) => onChange(formatCnic(e.target.value))}
        className={cn(
          "w-full px-3.5 py-2.5 rounded-lg border text-sm font-medium",
          "bg-brand-bg text-brand-purple placeholder-slate-400",
          "focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-colors",
          error ? "border-red-400" : "border-border",
          className
        )}
      />
    )
  }
)
