import { prisma } from "@/lib/prisma"
import { withPermission, json } from "@/lib/with-permission"
import { z } from "zod"

const schema = z.object({
  codes: z.array(z.string()).min(1).max(2000),
})

export type MatchResult = {
  rawCode:    string
  employeeId: string | null
  hcmId:      string | null
  name:       string | null
  department: string | null
  matched:    boolean
}

// ── POST /api/attendance/match-employees ──────────────────────────────────────
export async function POST(req: Request) {
  const guard = await withPermission("attendance:upload")
  if (guard) return guard

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const { codes } = parsed.data
  const uniqueCodes = [...new Set(codes.map((c) => c.trim()))]

  const employees = await prisma.employee.findMany({
    where: { hcmId: { in: uniqueCodes } },
    select: {
      id:         true,
      hcmId:      true,
      name:       true,
      department: { select: { name: true } },
    },
  })

  const byHcmId = new Map(employees.map((e) => [e.hcmId, e]))

  const results: MatchResult[] = uniqueCodes.map((rawCode) => {
    const emp = byHcmId.get(rawCode) ?? null
    return {
      rawCode,
      employeeId: emp?.id         ?? null,
      hcmId:      emp?.hcmId      ?? null,
      name:       emp?.name       ?? null,
      department: emp?.department?.name ?? null,
      matched:    !!emp,
    }
  })

  const matched   = results.filter((r) => r.matched).length
  const unmatched = results.length - matched

  return json({
    results,
    stats: { matched, unmatched, total: results.length },
  })
}
