/**
 * Server-side Route Handler guard.
 *
 * Usage in a Route Handler:
 *
 *   export async function POST(req: Request) {
 *     const guard = await withPermission("employees:create")
 *     if (guard) return guard          // returns 401 or 403 Response
 *     // ... rest of handler
 *   }
 */
import { auth } from "@/lib/auth"
import { hasPermission, type Permission } from "@/lib/rbac"
import type { Role } from "@/types"

export async function withPermission(
  permission: Permission
): Promise<Response | null> {
  const session = await auth()

  if (!session?.user) {
    return new Response(
      JSON.stringify({ error: "Unauthorised — please sign in." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }

  if (!hasPermission(session.user.role as Role, permission)) {
    return new Response(
      JSON.stringify({
        error: `Forbidden — you need the '${permission}' permission.`,
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    )
  }

  return null // caller is permitted — proceed
}

/**
 * Typed JSON response helper (convenience wrapper).
 */
export function json<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
