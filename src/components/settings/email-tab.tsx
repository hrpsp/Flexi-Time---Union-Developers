"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Mail, Pencil, Loader2, X, AlertCircle, Eye, EyeOff, Save } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface EmailTemplate {
  id:        string
  key:       string
  subject:   string
  htmlBody:  string
  variables: string[]
  updatedAt: string
}

// Sample data for preview substitution
const SAMPLE_VALUES: Record<string, string> = {
  employeeName:    "Muhammad Ali",
  employeeCode:    "EMP-001",
  department:      "Information Technology",
  designation:     "Software Engineer",
  period:          "April 2025",
  date:            format(new Date(), "dd MMM yyyy"),
  totalPresent:    "22",
  totalAbsent:     "2",
  attendancePct:   "91.6%",
  leaveType:       "Annual Leave",
  leaveFrom:       "15 Apr 2025",
  leaveTo:         "17 Apr 2025",
  approvedBy:      "Admin User",
  companyName:     "Union Developers",
}

function renderPreview(htmlBody: string, variables: string[]): string {
  let result = htmlBody
  for (const v of variables) {
    const sample = SAMPLE_VALUES[v] ?? `[${v}]`
    result = result.replace(new RegExp(`\\{\\{${v}\\}\\}`, "g"), sample)
  }
  return result
}

function keyToLabel(key: string): string {
  return key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor Modal
// ─────────────────────────────────────────────────────────────────────────────

function EditorModal({
  open,
  template,
  onClose,
  onSaved,
}: {
  open:     boolean
  template: EmailTemplate | null
  onClose:  () => void
  onSaved:  (t: EmailTemplate) => void
}) {
  const [subject,     setSubject]     = useState("")
  const [htmlBody,    setHtmlBody]    = useState("")
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState("")
  const [showPreview, setShowPreview] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (open && template) {
      setError("")
      setSubject(template.subject)
      setHtmlBody(template.htmlBody)
      setShowPreview(false)
    }
  }, [open, template])

  useEffect(() => {
    if (showPreview && iframeRef.current && template) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        doc.write(renderPreview(htmlBody, template.variables))
        doc.close()
      }
    }
  }, [showPreview, htmlBody, template])

  if (!open || !template) return null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      const res  = await fetch(`/api/settings/email-templates/${template!.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ subject, htmlBody }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to save template.")
        return
      }
      toast.success("Template saved.")
      onSaved(data.template)
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
      <div className="bg-white rounded-2xl shadow-2xl shadow-[#322E53]/20 border border-border w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <h3 className="text-base font-bold text-[#322E53]">{keyToLabel(template.key)}</h3>
            <p className="text-xs text-slate-400 font-medium font-mono mt-0.5">{template.key}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                showPreview
                  ? "bg-[#322E53] text-white"
                  : "border border-border text-[#322E53] hover:bg-[#F5F4F8]"
              )}
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPreview ? "Edit" : "Preview"}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-[#322E53] hover:bg-[#F5F4F8] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Subject */}
            <div>
              <label className={labelCls}>Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={fieldCls}
                required
                disabled={showPreview}
              />
            </div>

            {/* Body / Preview */}
            <div>
              <label className={labelCls}>{showPreview ? "Preview (sample data)" : "HTML Body"}</label>
              {showPreview ? (
                <iframe
                  ref={iframeRef}
                  className="w-full h-80 border border-border rounded-xl bg-white"
                  sandbox="allow-same-origin"
                  title="Email preview"
                />
              ) : (
                <textarea
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  rows={14}
                  className={cn(fieldCls, "resize-y font-mono text-xs leading-relaxed")}
                  placeholder="<p>Hello {{employeeName}},</p>"
                  required
                />
              )}
            </div>

            {/* Variable hints */}
            {!showPreview && template.variables.length > 0 && (
              <div>
                <p className={cn(labelCls, "mb-2")}>Available Variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {template.variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setHtmlBody((b) => b + `{{${v}}}`)}
                      title={`Insert {{${v}}}`}
                      className="px-2 py-1 rounded-lg bg-[#F5F4F8] hover:bg-[#E8E6EF] border border-[#E8E6EF] text-[11px] font-mono text-[#322E53] font-semibold transition-colors"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-1.5">
                  Click a variable to insert it at the cursor position.
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0">
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
              disabled={saving || showPreview}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#322E53] text-white text-sm font-bold hover:bg-[#49426E] transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Template
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Email Tab
// ─────────────────────────────────────────────────────────────────────────────

export function EmailTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editing,   setEditing]   = useState<EmailTemplate | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/settings/email-templates")
      const data = await res.json()
      if (res.ok) setTemplates(data.templates ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  function handleSaved(saved: EmailTemplate) {
    setTemplates((prev) => prev.map((t) => t.id === saved.id ? saved : t))
  }

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
      <div>
        <h3 className="text-base font-bold text-[#322E53]">Email Templates</h3>
        <p className="text-sm text-muted-foreground font-medium mt-0.5">
          Customize the content of automated emails sent by the system.
        </p>
      </div>

      {/* Template list */}
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-border text-center">
          <Mail className="w-9 h-9 text-[#EEC293] mb-3" />
          <p className="font-bold text-[#322E53]">No email templates</p>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Templates will appear here once seeded in the database.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-2xl border border-border p-4 flex items-start gap-4 hover:border-[#322E53]/30 transition-colors"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-[#F5F4F8] flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-[#49426E]" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#322E53] text-sm">{keyToLabel(t.key)}</p>
                <p className="text-xs font-mono text-slate-400 font-medium mt-0.5">{t.key}</p>
                <p className="text-xs text-slate-600 font-medium mt-1 truncate">{t.subject}</p>
                {t.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.variables.slice(0, 5).map((v) => (
                      <span key={v} className="px-1.5 py-0.5 rounded-md bg-[#F5F4F8] text-[10px] font-mono text-[#49426E] font-semibold">
                        {`{{${v}}}`}
                      </span>
                    ))}
                    {t.variables.length > 5 && (
                      <span className="text-[10px] text-slate-400 font-medium self-center">
                        +{t.variables.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Meta + Edit */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <button
                  onClick={() => setEditing(t)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-[#322E53] hover:bg-[#F5F4F8] transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
                <p className="text-[10px] text-slate-400 font-medium">
                  Updated {format(new Date(t.updatedAt), "dd MMM yyyy")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      <EditorModal
        open={!!editing}
        template={editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />
    </div>
  )
}
