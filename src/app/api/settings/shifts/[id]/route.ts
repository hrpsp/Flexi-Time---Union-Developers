import { withPermission, json } from "@/lib/with-permission"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.union([
  z.object({ action: z.literal("set-default") }),
  z.object({
    action:         z.undefined().optional(),
    name:           z.string().min(1).max(80).optional(),
    startTime:      z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime:        z.string().regex(/^\d{2}:\d{2}$/).optional(),
    graceMinutes:   z.number().int().min(0).max(120).optional(),
    presentMinutes: z.number().int().min(1).max(1440).optional(),
    shortTimeMin:   z.number().int().min(1).max(1440).optional(),
    halfDayMin:     z.number().int().min(1).max(1440).optional(),
  }),
])

// ── PATCH /api/settings/shifts/[id] ──────────────────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await withPermission("settings:manage")
  if (guard) return guard

  const shift = await prisma.shiftConfig.findUnique({ where: { id: params.id } })
  if (!shift) return json({ error: "Shift not found." }, 404)

  const body   = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const data = parsed.data

  // ── Set Default ────────────────────────────────────────────────────────────
  if ("action" in data && data.action === "set-default") {
    await prisma.shiftConfig.updateMany({ data: { isDefault: false } })
    const updated = await prisma.shiftConfig.update({
      where: { id: params.id },
      data:  { isDefault: true },
    })
    return json({ shift: updated })
  }

  // ── Update Fields ──────────────────────────────────────────────────────────
  const { action: _action, ...fields } = data as { action?: undefined } & Record<string, unknown>
  void _action

  // Validate thresholds if any are being changed
  const pm  = (fields.presentMinutes as number | undefined) ?? shift.presentMinutes
  const stm = (fields.shortTimeMin   as number | undefined) ?? shift.shortTimeMin
  const hdm = (fields.halfDayMin     as number | undefined) ?? shift.halfDayMin

  if (hdm >= stm || stm >= pm) {
    return json(
      { error: "Thresholds must satisfy: Half Day < Short Time < Present" },
      422
    )
  }

  const updated = await prisma.shiftConfig.update({
    where: { id: params.id },
    data:  fields as Parameters<typeof prisma.shiftConfig.update>[0]["data"],
  })

  return json({ shift: updated })
}

// ── DELETE /api/settings/shifts/[id] ─────────────────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await withPermission("settings:manage")
  if (guard) return guard

  const shift = await prisma.shiftConfig.findUnique({ where: { id: params.id } })
  if (!shift) return json({ error: "Shift not found." }, 404)

  const total = await prisma.shiftConfig.count()

  if (total === 1) {
    return json(
      { error: "Cannot delete the only shift profile. At least one must exist." },
      409
    )
  }

  if (shift.isDefault) {
    return json(
      { error: "Cannot delete the default shift. Set another shift as default first." },
      409
    )
  }

  await prisma.shiftConfig.delete({ where: { id: params.id } })
  return json({ success: true })
}
