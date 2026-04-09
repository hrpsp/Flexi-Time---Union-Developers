"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Search, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface DeptOption {
  id:   string
  code: number
  name: string
}

interface SearchableDeptSelectProps {
  options:      DeptOption[]
  value:        string           // departmentId
  onChange:     (id: string) => void
  placeholder?: string
  error?:       string
  disabled?:    boolean
  loading?:     boolean
}

export function SearchableDeptSelect({
  options,
  value,
  onChange,
  placeholder = "Select department…",
  error,
  disabled,
  loading,
}: SearchableDeptSelectProps) {
  const [open,   setOpen]   = useState(false)
  const [query,  setQuery]  = useState("")
  const ref                 = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.id === value)

  const filtered = query
    ? options.filter(
        (o) =>
          o.name.toLowerCase().includes(query.toLowerCase()) ||
          String(o.code).includes(query)
      )
    : options

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  const inputCls =
    "w-full px-3.5 py-2.5 rounded-lg border text-sm font-medium " +
    "focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-colors " +
    "bg-brand-bg text-brand-purple placeholder-slate-400 " +
    (error ? "border-red-400" : "border-border")

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          inputCls,
          "flex items-center justify-between gap-2 text-left",
          disabled && "opacity-50 cursor-not-allowed",
          !selected && "text-slate-400"
        )}
      >
        <span className="truncate">
          {loading ? "Loading departments…" : selected ? selected.name : placeholder}
        </span>
        <ChevronDown className={cn("w-4 h-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 bg-white border border-border rounded-xl shadow-lg shadow-brand-purple/10 overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search department…"
              className="flex-1 text-sm bg-transparent outline-none text-brand-purple placeholder-slate-400 font-medium"
            />
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center font-medium">
                No departments found
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { onChange(opt.id); setQuery(""); setOpen(false) }}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-medium text-left transition-colors",
                    opt.id === value
                      ? "bg-brand-purple/5 text-brand-purple"
                      : "text-slate-700 hover:bg-brand-bg"
                  )}
                >
                  <span className="w-8 text-[10px] font-bold text-muted-foreground shrink-0">
                    {opt.code}
                  </span>
                  <span className="flex-1 truncate">{opt.name}</span>
                  {opt.id === value && <Check className="w-3.5 h-3.5 text-brand-purple shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
