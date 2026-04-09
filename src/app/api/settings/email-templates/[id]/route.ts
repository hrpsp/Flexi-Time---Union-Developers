import { withPermission, json } from "@/lib/with-permission"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  subject:  z.string().min(1, "Subject is required").max(200),
  htmlBody: z.string().min(1, "Body is required"),
})

// ── PATCH /api/settings/email-templates/[id] ─────────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await withPermission("settings:manage")
  if (guard) return guard

  const template = await prisma.emailTemplate.findUnique({ where: { id: params.id } })
  if (!template) return json({ error: "Template not found." }, 404)

  const body   = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const updated = await prisma.emailTemplate.update({
    where: { id: params.id },
    data:  parsed.data,
  })

  return json({
    template: {
      id:        updated.id,
      key:       updated.key,
      subject:   updated.subject,
      htmlBody:  updated.htmlBody,
      variables: updated.variables,
      updatedAt: updated.updatedAt.toISOString(),
    },
  })
}
