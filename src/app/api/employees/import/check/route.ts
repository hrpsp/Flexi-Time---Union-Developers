import { prisma } from "@/lib/prisma"
import { withPermission, json } from "@/lib/with-permission"

// POST /api/employees/import/check
// Body: { hcmIds: string[], deptIdentifiers: string[] }
// Returns: { existingIds: string[], deptMap: Record<string, { id, name }>, newDepts: string[] }
//
// Auto-creates any department names that don't exist yet so the import
// never fails on a missing department — the settings page reflects them immediately.
export async function POST(req: Request) {
    const guard = await withPermission("employees:import")
    if (guard) return guard

  const body             = await req.json()
    const hcmIds: string[] = body.hcmIds          ?? []
        const deptIdentifiers: string[] = body.deptIdentifiers ?? []

            // ── Existing employees ──────────────────────────────────────────────────────
            const existing = hcmIds.length
      ? await prisma.employee.findMany({
                where:  { hcmId: { in: hcmIds } },
                select: { hcmId: true },
      })
                  : []

                // ── Department resolution ───────────────────────────────────────────────────
                const numericCodes = deptIdentifiers
      .map((d) => Number(d))
      .filter((n) => Number.isInteger(n) && n > 0)

  const stringNames = deptIdentifiers.filter((d) => isNaN(Number(d)))

  const orClauses: object[] = [
        ...(stringNames.length  ? [{ name: { in: stringNames, mode: "insensitive" as const } }] : []),
        ...(numericCodes.length ? [{ code: { in: numericCodes } }]                               : []),
      ]

  const foundDepts = orClauses.length
      ? await prisma.department.findMany({
                where:  { OR: orClauses },          // include inactive — we'll reactivate below
                select: { id: true, name: true, code: true, isActive: true },
            })
        : []

      // Build lookup: normalised-name -> dept
      const foundByName = new Map<string, typeof foundDepts[0]>()
    const foundByCode = new Map<number, typeof foundDepts[0]>()
          for (const d of foundDepts) {
                foundByName.set(d.name.toLowerCase(), d)
                foundByCode.set(d.code, d)
          }

  // ── Auto-create / reactivate missing name-based departments ────────────────
  // (numeric-code identifiers that aren't found are left as-is; the UI
  //  shows them as errors since we can't infer a name from just a number.)
  const newDeptNames: string[] = []
      const autoCreated: { id: string; name: string; code: number }[] = []

          // Get highest existing code to generate new codes sequentially
          let maxCode = (await prisma.department.aggregate({ _max: { code: true } }))._max.code ?? 100

  for (const identifier of stringNames) {
        const key = identifier.toLowerCase().trim()
        if (!key) continue

      const existing = foundByName.get(key)
    if (existing) {
                  // Reactivate if it was deactivated
          if (!existing.isActive) {
                    await prisma.department.update({
                                where: { id: existing.id },
                                data:  { isActive: true },
})
          existing.isActive = true
          }
            continue
    }

      // Not found — create it
      maxCode += 1
        const created = await prisma.department.create({
                data: {
                          code:     maxCode,
                          name:     identifier.trim(),
                          isActive: true,
                },
                select: { id: true, name: true, code: true },
        })
        foundByName.set(key, { ...created, isActive: true })
        newDeptNames.push(created.name)
        autoCreated.push(created)
  }

  // ── Build deptMap (key = lower-name or numeric-code string) ────────────────
  const deptMap: Record<string, { id: string; name: string }> = {}
      for (const [, d] of foundByName) {
            deptMap[d.name.toLowerCase()] = { id: d.id, name: d.name }
      }
    for (const [code, d] of foundByCode) {
          deptMap[String(code)] = { id: d.id, name: d.name }
    }
    // Also include auto-created ones by code
  for (const d of autoCreated) {
        deptMap[String(d.code)] = { id: d.id, name: d.name }
  }

  return json({
        existingIds: existing.map((e) => e.hcmId),
        deptMap,
        newDepts: newDeptNames,   // names of departments auto-created during this check
  })
}
