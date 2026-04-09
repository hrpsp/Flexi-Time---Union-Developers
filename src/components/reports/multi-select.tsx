"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Check, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string
  label: string
  color?: string   // optional dot color (e.g. "bg-emerald-500")
}

interface MultiSelectProps {
  label:       string
  options:     SelectOption[]
  selected:    string[]
  onChange:    (selected: string[]) => void
  placeholder?: string
  searchable?:  boolean
  className?:   string
  maxDisplay?:  number    // max items shown in trigger before "N selected"
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = "All",
  searchable  = true,
  className,
  maxDisplay  = 1,
}: MultiSelectProps) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState("")
  const ref               = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  const allSelected   = selected.length === 0 || selected.length === options.length
  const noneSelected  = selected.length === 0

  function toggleOption(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  function toggleAll() {
    if (allSelected) {
      onChange([])
    } else {
      onChange(options.map((o) => o.value))
    }
  }

  // Trigger label
  function getTriggerLabel(): string {
    if (noneSelected || allSelected) return placeholder
    if (selected.length <= maxDisplay) {
      return options
        .filter((o) => selected.includes(o.value))
        .map((o) => o.label)
        .join(", ")
    }
    return `${selected.length} selected`
  }

  const isActive = !noneSelected && !allSelected

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold",
          "transition-colors whitespace-nowrap",
          isActive
            ? "border-[#322E53] bg-[#322E53] text-white"
            : "border-border bg-white text-[#322E53] hover:bg-[#F5F4F8]",
          open && !isActive && "border-[#322E53]/40"
        )}
      >
        <span className="text-xs">{label}:</span>
        <span className={cn("text-xs font-bold truncate max-w-[120px]", !isActive && "text-muted-foreground font-normal")}>
          {getTriggerLabel()}
        </span>
        {isActive && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange([]); setOpen(false) }}
            className="ml-0.5 text-white/70 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {!isActive && (
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-[calc(100%+6px)] left-0 min-w-[200px] max-w-[280px]
                        bg-white border border-border rounded-xl shadow-xl shadow-[#322E53]/10 overflow-hidden">
          {/* Search */}
          {searchable && options.length > 6 && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="flex-1 text-xs bg-transparent outline-none text-[#322E53] placeholder-slate-400"
              />
            </div>
          )}

          {/* Select All */}
          {!query && (
            <button
              type="button"
              onClick={toggleAll}
              className={cn(
                "w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold text-left",
                "border-b border-border transition-colors",
                allSelected
                  ? "bg-[#F5F4F8] text-[#322E53]"
                  : "text-[#322E53] hover:bg-[#F5F4F8]"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0",
                allSelected ? "border-[#322E53] bg-[#322E53]" : "border-slate-300"
              )}>
                {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
                {!allSelected && selected.length > 0 && (
                  <div className="w-2 h-0.5 bg-slate-400 rounded" />
                )}
              </div>
              All {label}
            </button>
          )}

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-xs text-muted-foreground text-center font-medium">
                No results
              </div>
            ) : (
              filtered.map((opt) => {
                const isSelected = selected.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleOption(opt.value)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left",
                      "transition-colors",
                      isSelected
                        ? "bg-[#322E53]/5 text-[#322E53]"
                        : "text-slate-700 hover:bg-[#F5F4F8]"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0",
                      isSelected ? "border-[#322E53] bg-[#322E53]" : "border-slate-300"
                    )}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    {opt.color && (
                      <span className={cn("w-2 h-2 rounded-full shrink-0", opt.color)} />
                    )}
                    <span className="flex-1 truncate">{opt.label}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
