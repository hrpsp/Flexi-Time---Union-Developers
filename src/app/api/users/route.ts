import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { withPermission, json } from "@/lib/with-permission"
import { createUserSchema, userQuerySchema } from "@/lib/validations/users"
import bcrypt from "bcryptjs"
import type { Role } from "@/types"

// ── GET /api/users ───────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const guard = await withPermission("users:read")
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const parsed = userQuerySchema.safeParse({
    search: searchParams.get("search") ?? undefined,
    role:   searchParams.get("role")   ?? "ALL",
    page:   searchParams.get("page")   ?? 1,
    limit:  searchParams.get("limit")  ?? 20,
  })
  if (!parsed.success) return json({ error: "Invalid query params" }, 400)

  const { search, role, page, limit } = parsed.data
  const skip = (page - 1) * limit

  const where = {
    ...(search
      ? {
          OR: [
            { name:  { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(role !== "ALL" ? { role: role as Role } : {}),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        isActive:  true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ])

  return json({ users, total, page, limit, pages: Math.ceil(total / limit) })
}

// ── POST /api/users ──────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const guard = await withPermission("users:create")
  if (guard) return guard

  const session = await auth()
  const body    = await req.json()
  const parsed  = createUserSchema.safeParse(body)
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422)

  const { name, email, role, password } = parsed.data

  // Check email uniqueness
  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) return json({ error: "A user with this email already exists." }, 409)

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: { name, email, role: role as Role, passwordHash },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId:     session!.user.id,
      action:     "USER_CREATE",
      entityType: "User",
      entityId:   user.id,
      before:     undefined,
      after:      { name, email, role },
    },
  })

  return json({ user }, 201)
}
