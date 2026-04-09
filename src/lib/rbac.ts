import type { Role } from "@/types"

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSION DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export const PERMISSIONS = [
  // Users
  "users:read",
  "users:create",
  "users:edit",
  "users:delete",
  // Employees
  "employees:read",
  "employees:create",
  "employees:edit",
  "employees:import",
  "employees:activate",
  "employees:deactivate",
  // Attendance
  "attendance:read",
  "attendance:upload",
  "attendance:override",
  "attendance:bulk-action",
  // Reports
  "reports:read",
  "reports:export",
  // Settings
  "settings:manage",
] as const

export type Permission = (typeof PERMISSIONS)[number]

// ─────────────────────────────────────────────────────────────────────────────
// ROLE → PERMISSION MAP
// ─────────────────────────────────────────────────────────────────────────────

const ALL_PERMISSIONS = [...PERMISSIONS] as Permission[]

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,

  ADMIN: ALL_PERMISSIONS,

  HR_MANAGER: [
    "users:read",
    "employees:read",
    "employees:create",
    "employees:edit",
    "employees:import",
    "employees:activate",
    "employees:deactivate",
    "attendance:read",
    "attendance:upload",
    "attendance:override",
    "attendance:bulk-action",
    "reports:read",
    "reports:export",
  ],

  HR_EXECUTIVE: [
    "employees:read",
    "attendance:read",
    "attendance:override",
    "reports:read",
  ],

  VIEWER: [
    "attendance:read",
    "reports:read",
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the given role has the requested permission.
 */
export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

/**
 * Returns the full permission list for a role.
 */
export function getPermissions(role: Role | null | undefined): Permission[] {
  if (!role) return []
  return ROLE_PERMISSIONS[role] ?? []
}

/**
 * Returns true if the role has ALL of the given permissions.
 */
export function hasAllPermissions(role: Role | null | undefined, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p))
}

/**
 * Returns true if the role has ANY of the given permissions.
 */
export function hasAnyPermission(role: Role | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

// Nav item → required permission (used to filter sidebar)
export const NAV_PERMISSIONS: Record<string, Permission> = {
  "/users":      "users:read",
  "/employees":  "employees:read",
  "/attendance": "attendance:read",
  "/reports":    "reports:read",
  "/settings":   "settings:manage",
}
