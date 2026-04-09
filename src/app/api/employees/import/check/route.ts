import { prisma }          from "@/lib/prisma"
import { withPermission, json } from "@/lib/with-permission"

// POST /api/employees/import/check
// Body: { hcmIds: string[], deptIdentifiers: string[] }
// Returns: { existingIds: string[], deptMap: Record<string, { id, name }> }

export async function POST(req: Request) {
  const guard = await withPermission("employees:import")
  if (guard) return guard

  const body              = await req.json()
  const hcmIds: string[]          = body.hcmIds          ?? []
  const deptIdentifiers: string[] = body.deptIdentifiers ?? []

  // ── Existing employees ────────────────────────────────────────────────────
  const existing = hcmIds.length
    ? await prisma.employee.findMany({
        where:  { hcmId: { in: hcmIds } },
        select: { hcmId: true },
      })
    : []

  // ── Department resolution ─────────────────────────────────────────────────
  const numericCodes = deptIdentifiers
    .map((d) => Number(d))
    .filter((n) => Number.isInteger(n) && n > 0)

  const stringNames = deptIdentifiers.filter((d) => isNaN(Number(d)))

  const orClauses: object[] = [
    ...(stringNames.length  ? [{ name: { in: stringNames,  mode: "insensitive" as const } }] : []),
    ...(numericCodes.length ? [{ code: { in: numericCodes } }]                                : []),
  ]

  const depts = orClauses.length
    ? await prisma.department.findMany({
        where:  { isActive: true, OR: orClauses },
        select: { id: true, name: true, code: true },
      })
    : []

  const deptMap: Record<string, { id: string; name: string }> = {}
  for (const d of depts) {
    deptMap[d.name.toLowerCase()] = { id: d.id, name: d.name }
    deptMap[String(d.code)]       = { id: d.id, name: d.name }
  }

  return json({
    existingIds: existing.map((e) => e.hcmId),
    deptMap,
  })
}
