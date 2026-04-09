import { prisma } from "@/lib/prisma"
import { withPermission, json } from "@/lib/with-permission"
import { z } from "zod"

const createPeriodSchema = z.object({
  label:     z.string().min(1).max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  isActive:  z.boolean().optional().default(false),
})

// ── GET /api/attendance/periods ───────────────────────────────────────────────
export async function GET() {
  const guard = await withPermission("attendance:read")
  if (guard) return guard

  const periods = await prisma.attendancePeriod.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { records: true } } },
  })

  return json({ periods })
}

// ── POST /api/attendance/periods ──────────────────────────────────────────────
export async function POST(req: Request) {
  const guard = await withPermission("attendance:upload")
  if (guard) return guard

  const body   = await req.json()
  const parsed = createPeriodSchema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const { label, startDate, endDate, isActive } = parsed.data

  const start = new Date(startDate)
  const end   = new Date(endDate)
  if (end < start) return json({ error: "endDate must be on or after startDate." }, 422)

  let period

  if (isActive) {
    // Deactivate all existing active periods, then create new active one
    const [, created] = await prisma.$transaction([
      prisma.attendancePeriod.updateMany({
        where: { isActive: true },
        data:  { isActive: false },
      }),
      prisma.attendancePeriod.create({
        data:    { label, startDate: start, endDate: end, isActive: true },
        include: { _count: { select: { records: true } } },
      }),
    ])
    period = created
  } else {
    period = await prisma.attendancePeriod.create({
      data:    { label, startDate: start, endDate: end, isActive: false },
      include: { _count: { select: { records: true } } },
    })
  }

  return json({ period }, 201)
}
