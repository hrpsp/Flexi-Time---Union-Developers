import { withPermission, json } from "@/lib/with-permission"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.union([
  z.object({ action: z.enum(["activate", "deactivate"]) }),
  z.object({ action: z.undefined().optional(), name: z.string().min(1).max(100) }),
])

// ── PATCH /api/settings/departments/[id] ─────────────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await withPermission("settings:manage")
  if (guard) return guard

  const dept = await prisma.department.findUnique({
    where:   { id: params.id },
    include: { _count: { select: { employees: true } } },
  })
  if (!dept) return json({ error: "Department not found." }, 404)

  const body   = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const data = parsed.data

  // ── Toggle active status ───────────────────────────────────────────────────
  if ("action" in data && (data.action === "activate" || data.action === "deactivate")) {
    const updated = await prisma.department.update({
      where:   { id: params.id },
      data:    { isActive: data.action === "activate" },
      include: { _count: { select: { employees: true } } },
    })
    return json({
      department: {
        id:        updated.id,
        code:      updated.code,
        name:      updated.name,
        isActive:  updated.isActive,
        createdAt: updated.createdAt.toISOString().slice(0, 10),
        employees: updated._count.employees,
      },
    })
  }

  // ── Rename ─────────────────────────────────────────────────────────────────
  const { name } = data as { name: string }

  const updated = await prisma.department.update({
    where:   { id: params.id },
    data:    { name },
    include: { _count: { select: { employees: true } } },
  })

  return json({
    department: {
      id:        updated.id,
      code:      updated.code,
      name:      updated.name,
      isActive:  updated.isActive,
      createdAt: updated.createdAt.toISOString().slice(0, 10),
      employees: updated._count.employees,
    },
  })
}
