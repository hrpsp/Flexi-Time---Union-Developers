import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { withPermission, json } from "@/lib/with-permission"
import { editUserSchema } from "@/lib/validations/users"
import type { Role } from "@/types"

// ── PATCH /api/users/[id] ────────────────────────────────────────────────────
// Updates: name, role, isActive (deactivate/activate)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await withPermission("users:edit")
  if (guard) return guard

  const session = await auth()
  const body    = await req.json()
  const { id }  = params

  // ── Toggle active status ──────────────────────────────────────────────────
  if ("isActive" in body) {
    // Prevent self-deactivation
    if (id === session!.user.id && body.isActive === false) {
      return json({ error: "You cannot deactivate your own account." }, 400)
    }

    const before = await prisma.user.findUnique({
      where:  { id },
      select: { isActive: true, name: true },
    })
    if (!before) return json({ error: "User not found." }, 404)

    const user = await prisma.user.update({
      where:  { id },
      data:   { isActive: body.isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    })

    await prisma.auditLog.create({
      data: {
        userId:     session!.user.id,
        action:     body.isActive ? "USER_ACTIVATE" : "USER_DEACTIVATE",
        entityType: "User",
        entityId:   id,
        before:     { isActive: before.isActive },
        after:      { isActive: body.isActive },
      },
    })

    return json({ user })
  }

  // ── Edit name / role ──────────────────────────────────────────────────────
  const parsed = editUserSchema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const before = await prisma.user.findUnique({
    where:  { id },
    select: { name: true, role: true },
  })
  if (!before) return json({ error: "User not found." }, 404)

  const user = await prisma.user.update({
    where:  { id },
    data:   { name: parsed.data.name, role: parsed.data.role as Role },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  })

  await prisma.auditLog.create({
    data: {
      userId:     session!.user.id,
      action:     "USER_EDIT",
      entityType: "User",
      entityId:   id,
      before:     { name: before.name, role: before.role },
      after:      { name: parsed.data.name, role: parsed.data.role },
    },
  })

  return json({ user })
}
