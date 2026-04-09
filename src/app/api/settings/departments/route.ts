import { withPermission, json } from "@/lib/with-permission"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  code: z.number().int().min(1).max(9999),
  name: z.string().min(1, "Name is required").max(100),
})

// ── GET /api/settings/departments ────────────────────────────────────────────
export async function GET() {
  const guard = await withPermission("settings:manage")
  if (guard) return guard

  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true } } },
  })

  return json({
    departments: departments.map((d) => ({
      id:        d.id,
      code:      d.code,
      name:      d.name,
      isActive:  d.isActive,
      createdAt: d.createdAt.toISOString().slice(0, 10),
      employees: d._count.employees,
    })),
  })
}

// ── POST /api/settings/departments ───────────────────────────────────────────
export async function POST(req: Request) {
  const guard = await withPermission("settings:manage")
  if (guard) return guard

  const body   = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const { code, name } = parsed.data

  // Uniqueness checks
  const existingCode = await prisma.department.findUnique({ where: { code } })
  if (existingCode) return json({ error: `Department code ${code} is already in use.` }, 409)

  const dept = await prisma.department.create({
    data:    { code, name, isActive: true },
    include: { _count: { select: { employees: true } } },
  })

  return json({
    department: {
      id:        dept.id,
      code:      dept.code,
      name:      dept.name,
      isActive:  dept.isActive,
      createdAt: dept.createdAt.toISOString().slice(0, 10),
      employees: dept._count.employees,
    },
  }, 201)
}
