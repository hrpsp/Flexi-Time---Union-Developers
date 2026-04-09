import { z } from "zod"

// All 5 roles from the Prisma schema
export const ROLES = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "HR_EXECUTIVE", "VIEWER"] as const
export type RoleEnum = (typeof ROLES)[number]

// ── Create user ─────────────────────────────────────────────────────────────
export const createUserSchema = z.object({
  name:     z.string().min(2, "Name must be at least 2 characters").max(100),
  email:    z.string().email("Enter a valid email address"),
  role:     z.enum(ROLES, { required_error: "Select a role" }),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
})
export type CreateUserInput = z.infer<typeof createUserSchema>

// ── Edit user (no password change) ──────────────────────────────────────────
export const editUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  role: z.enum(ROLES, { required_error: "Select a role" }),
})
export type EditUserInput = z.infer<typeof editUserSchema>

// ── Reset password ───────────────────────────────────────────────────────────
export const resetPasswordSchema = z
  .object({
    password:        z.string().min(8, "Minimum 8 characters").regex(/[A-Z]/, "Must contain an uppercase letter").regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path:    ["confirmPassword"],
  })
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

// ── API query params ─────────────────────────────────────────────────────────
export const userQuerySchema = z.object({
  search: z.string().optional(),
  role:   z.enum([...ROLES, "ALL"] as const).optional().default("ALL"),
  page:   z.coerce.number().min(1).optional().default(1),
  limit:  z.coerce.number().min(1).max(100).optional().default(20),
})
export type UserQuery = z.infer<typeof userQuerySchema>
