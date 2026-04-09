import { prisma } from "@/lib/prisma"
import { withPermission, json } from "@/lib/with-permission"

// GET /api/departments  →  all active departments, sorted by name
export async function GET() {
  const guard = await withPermission("employees:read")
  if (guard) return guard

  const departments = await prisma.department.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select:  { id: true, code: true, name: true },
  })

  return json({ departments })
}
