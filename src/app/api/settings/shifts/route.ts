import { withPermission, json } from "@/lib/with-permission"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  name:           z.string().min(1, "Name is required").max(80),
  startTime:      z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  endTime:        z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  graceMinutes:   z.number().int().min(0).max(120).default(15),
  presentMinutes: z.number().int().min(1).max(1440).default(465),
  shortTimeMin:   z.number().int().min(1).max(1440).default(391),
  halfDayMin:     z.number().int().min(1).max(1440).default(240),
  isDefault:      z.boolean().default(false),
})

// ── GET /api/settings/shifts ──────────────────────────────────────────────────
export async function GET() {
  const guard = await withPermission("settings:manage")
  if (guard) return guard

  const shifts = await prisma.shiftConfig.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  })

  return json({ shifts })
}

// ── POST /api/settings/shifts ─────────────────────────────────────────────────
export async function POST(req: Request) {
  const guard = await withPermission("settings:manage")
  if (guard) return guard

  const body   = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const data = parsed.data

  // Validate threshold ordering
  if (data.halfDayMin >= data.shortTimeMin || data.shortTimeMin >= data.presentMinutes) {
    return json(
      { error: "Thresholds must satisfy: Half Day < Short Time < Present" },
      422
    )
  }

  // If setting as default, unset all others first
  if (data.isDefault) {
    await prisma.shiftConfig.updateMany({ data: { isDefault: false } })
  }

  // If this is the first shift, force it to be default
  const count = await prisma.shiftConfig.count()
  const isDefault = data.isDefault || count === 0

  const shift = await prisma.shiftConfig.create({
    data: { ...data, isDefault },
  })

  return json({ shift }, 201)
}
