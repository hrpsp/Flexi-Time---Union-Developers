"use client"

import { useState } from "react"
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Column<T> {
  key:        keyof T | string
  header:     string
  sortable?:  boolean
  width?:     string
  className?: string
  render?:    (value: unknown, row: T) => React.ReactNode
}

interface DataTableProps<T extends Record<string, unknown>> {
  data:         T[]
  columns:      Column<T>[]
  searchable?:  boolean
  searchKeys?:  (keyof T)[]
  pageSize?:    number
  emptyText?:   string
  className?:   string
  onRowClick?:  (row: T) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchable  = true,
  searchKeys  = [],
  pageSize    = 15,
  emptyText   = "No records found.",
  className,
  onRowClick,
}: DataTableProps<T>) {
  const [query,   setQuery]   = useState("")
  const [page,    setPage]    = useState(1)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  // Filter
  const filtered = searchable && query
    ? data.filter((row) =>
        searchKeys.some((k) =>
          String(row[k] ?? "").toLowerCase().includes(query.toLowerCase())
        )
      )
    : data

  // Sort
  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const av = a[sortKey as keyof T] ?? ""
        const bv = b[sortKey as keyof T] ?? ""
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === "asc" ? cmp : -cmp
      })
    : filtered

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paginated  = sorted.slice((page - 1) * pageSize, page * pageSize)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
    setPage(1)
  }

  const handleSearch = (q: string) => {
    setQuery(q)
    setPage(1)
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>

      {/* Search */}
      {searchable && (
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-border w-full max-w-xs">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search…"
            className="flex-1 text-sm bg-transparent outline-none text-[#322E53] placeholder-slate-400 font-medium"
          />
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">

            {/* Head */}
            <thead>
              <tr className="border-b border-border bg-[#F5F4F8]">
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    style={{ width: col.width }}
                    className={cn(
                      "px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#49426E]",
                      col.sortable && "cursor-pointer select-none hover:text-[#322E53]",
                      col.className
                    )}
                    onClick={() => col.sortable && handleSort(String(col.key))}
                  >
                    <div className="flex items-center gap-1">
                      {col.header}
                      {col.sortable && (
                        sortKey === String(col.key)
                          ? sortDir === "asc"
                            ? <ChevronUp   className="w-3 h-3 text-[#322E53]" />
                            : <ChevronDown className="w-3 h-3 text-[#322E53]" />
                          : <ChevronsUpDown className="w-3 h-3 text-slate-300" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-sm text-muted-foreground font-medium"
                  >
                    {emptyText}
                  </td>
                </tr>
              ) : (
                paginated.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors",
                      onRowClick && "cursor-pointer",
                      i % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]",
                      onRowClick && "hover:bg-[#F5F4F8]"
                    )}
                  >
                    {columns.map((col) => {
                      const val = row[col.key as keyof T]
                      return (
                        <td
                          key={String(col.key)}
                          className={cn("px-4 py-3 text-[#322E53] font-medium", col.className)}
                        >
                          {col.render ? col.render(val, row) : String(val ?? "—")}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-[#F5F4F8]">
            <p className="text-xs text-muted-foreground font-medium">
              {sorted.length} record{sorted.length !== 1 ? "s" : ""}
              {" · "}Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-white border border-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-[#322E53]" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-white border border-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-[#322E53]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
