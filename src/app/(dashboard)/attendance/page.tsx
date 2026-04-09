"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Upload, Eye } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { PeriodSection } from "@/components/attendance/period-section"
import { UploadDialog } from "@/components/attendance/upload-dialog"
import { usePermission } from "@/hooks/use-permission"
import type { Period } from "@/components/attendance/period-section"

export default function AttendancePage() {
  const canUpload = usePermission("attendance:upload")
  const router    = useRouter()

  const [showUpload, setShowUpload] = useState(false)
  const [periods,    setPeriods]    = useState<Period[]>([])
  const [loading,    setLoading]    = useState(true)

  const fetchPeriods = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/attendance/periods")
      const data = await res.json()
      if (res.ok) setPeriods(data.periods)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPeriods() }, [fetchPeriods])

  const activePeriod = periods.find((p) => p.isActive)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Attendance"
        description="Manage attendance periods and upload biometric data."
      >
        {activePeriod && (
          <button
            onClick={() => router.push(`/attendance/${activePeriod.id}/grid`)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#322E53]
                       text-[#322E53] text-sm font-bold hover:bg-[#F5F4F8] transition-colors"
          >
            <Eye className="w-4 h-4" />
            View Active Grid
          </button>
        )}
        {canUpload && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#322E53] text-white
                       text-sm font-bold hover:bg-[#49426E] transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Data
          </button>
        )}
      </PageHeader>

      <PeriodSection
        periods={periods}
        loading={loading}
        onRefresh={fetchPeriods}
      />

      {canUpload && (
        <UploadDialog
          open={showUpload}
          onClose={() => setShowUpload(false)}
          periods={periods}
          onSynced={(periodId) => {
            fetchPeriods()
            router.push(`/attendance/${periodId}/grid`)
          }}
        />
      )}
    </div>
  )
}
