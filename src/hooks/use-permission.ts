"use client"

import { useSession } from "next-auth/react"
import { hasPermission, hasAnyPermission, hasAllPermissions, type Permission } from "@/lib/rbac"
import type { Role } from "@/types"

/**
 * Check a single permission against the logged-in user's role.
 *
 * @example
 *   const canEdit = usePermission("employees:edit")
 *   if (!canEdit) return null
 */
export function usePermission(permission: Permission): boolean {
  const { data: session } = useSession()
  return hasPermission(session?.user?.role as Role | undefined, permission)
}

/**
 * Check multiple permissions — returns true if the user has ALL of them.
 */
export function useAllPermissions(permissions: Permission[]): boolean {
  const { data: session } = useSession()
  return hasAllPermissions(session?.user?.role as Role | undefined, permissions)
}

/**
 * Check multiple permissions — returns true if the user has ANY of them.
 */
export function useAnyPermission(permissions: Permission[]): boolean {
  const { data: session } = useSession()
  return hasAnyPermission(session?.user?.role as Role | undefined, permissions)
}

/**
 * Returns the full session user object (id, name, email, role).
 * Returns null while loading or if unauthenticated.
 */
export function useCurrentUser() {
  const { data: session, status } = useSession()
  return {
    user:    session?.user ?? null,
    role:    (session?.user?.role as Role | undefined) ?? null,
    loading: status === "loading",
  }
}
