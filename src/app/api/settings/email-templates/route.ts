import { withPermission, json } from "@/lib/with-permission"
import { prisma } from "@/lib/prisma"

// ── GET /api/settings/email-templates ────────────────────────────────────────
export async function GET() {
  const guard = await withPermission("settings:manage")
  if (guard) return guard

  const templates = await prisma.emailTemplate.findMany({
    orderBy: { key: "asc" },
    select: {
      id:        true,
      key:       true,
      subject:   true,
      htmlBody:  true,
      variables: true,
      updatedAt: true,
    },
  })

  return json({
    templates: templates.map((t) => ({
      ...t,
      updatedAt: t.updatedAt.toISOString(),
    })),
  })
}
