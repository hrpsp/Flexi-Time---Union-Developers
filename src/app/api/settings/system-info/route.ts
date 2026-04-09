import { withPermission, json } from "@/lib/with-permission"
import { prisma } from "@/lib/prisma"

// ── GET /api/settings/system-info ────────────────────────────────────────────
export async function GET() {
  const guard = await withPermission("settings:manage")
  if (guard) return guard

  // DB connection check
  let dbStatus: "connected" | "error" = "connected"
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbStatus = "error"
  }

  // Parallel queries
  const [employeeCount, userCount, lastSyncRecord] = await Promise.all([
    prisma.employee.count(),
    prisma.user.count(),
    prisma.attendanceRecord.findFirst({
      orderBy: { updatedAt: "desc" },
      select:  { updatedAt: true },
    }),
  ])

  const appVersion = process.env.npm_package_version ?? "1.0.0"

  return json({
    appVersion,
    dbStatus,
    lastSyncAt:     lastSyncRecord?.updatedAt?.toISOString() ?? null,
    totalEmployees: employeeCount,
    totalUsers:     userCount,
    environment:    process.env.NODE_ENV ?? "production",
    generatedAt:    new Date().toISOString(),
  })
}
