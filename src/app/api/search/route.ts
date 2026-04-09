import { withPermission, json } from "@/lib/with-permission"
import { prisma } from "@/lib/prisma"

// ── GET /api/search?q=... ─────────────────────────────────────────────────────
export async function GET(req: Request) {
  const guard = await withPermission("employees:read")
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") ?? "").trim()

  if (!q || q.length < 1) return json({ employees: [] })

  const employees = await prisma.employee.findMany({
    where: {
      OR: [
        { name:  { contains: q, mode: "insensitive" } },
        { hcmId: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id:          true,
      hcmId:       true,
      name:        true,
      designation: true,
      status:      true,
      department:  { select: { name: true } },
    },
    take: 6,
    orderBy: { name: "asc" },
  })

  return json({ employees })
}
