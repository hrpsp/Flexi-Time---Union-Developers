import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { withPermission, json } from "@/lib/with-permission"
import { resetPasswordSchema } from "@/lib/validations/users"
import bcrypt from "bcryptjs"

// ── POST /api/users/[id]/reset-password ──────────────────────────────────────
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await withPermission("users:edit")
  if (guard) return guard

  const session = await auth()
  const body    = await req.json()
  const parsed  = resetPasswordSchema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const user = await prisma.user.findUnique({ where: { id: params.id } })
  if (!user) return json({ error: "User not found." }, 404)

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  await prisma.user.update({
    where: { id: params.id },
    data:  { passwordHash },
  })

  await prisma.auditLog.create({
    data: {
      userId:     session!.user.id,
      action:     "USER_RESET_PASSWORD",
      entityType: "User",
      entityId:   params.id,
      before:     undefined,
      after:      { note: "Password reset by admin" },
    },
  })

  return json({ message: "Password reset successfully." })
}
