import { prisma } from "@/lib/prisma"
import { withPermission, json } from "@/lib/with-permission"
import { z } from "zod"

const patchSchema = z.object({
  action: z.enum(["activate", "deactivate"]),
})

// ── PATCH /api/attendance/periods/[id] ───────────────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await withPermission("attendance:upload")
  if (guard) return guard

  const body   = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const period = await prisma.attendancePeriod.findUnique({ where: { id: params.id } })
  if (!period) return json({ error: "Period not found." }, 404)

  if (parsed.data.action === "activate") {
    // Deactivate all then activate the target
    await prisma.attendancePeriod.updateMany({ where: { isActive: true }, data: { isActive: false } })
    const updated = await prisma.attendancePeriod.update({
      where:   { id: params.id },
      data:    { isActive: true },
      include: { _count: { select: { records: true } } },
    })
    return json({ period: updated })
  } else {
    const updated = await prisma.attendancePeriod.update({
      where:   { id: params.id },
      data:    { isActive: false },
      include: { _count: { select: { records: true } } },
    })
    return json({ period: updated })
  }
}

// ── DELETE /api/attendance/periods/[id] ──────────────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await withPermission("attendance:upload")
  if (guard) return guard

  const period = await prisma.attendancePeriod.findUnique({
    where:   { id: params.id },
    include: { _count: { select: { records: true } } },
  })
  if (!period) return json({ error: "Period not found." }, 404)

  if (period._count.records > 0) {
    return json(
      { error: `Cannot delete — this period has ${period._count.records} attendance record(s). Clear records first.` },
      409
    )
  }

  await prisma.attendancePeriod.delete({ where: { id: params.id } })
  return json({ success: true })
}
