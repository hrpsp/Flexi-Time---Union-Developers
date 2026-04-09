import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { loginSchema } from "@/lib/validations/auth"
import authConfig from "@/lib/auth.config"
import type { Role } from "@/types"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  // Override providers with the full Node-runtime implementation
  providers: [
    Credentials({
      async authorize(credentials) {
        // 1. Validate shape
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        // 2. Look up user
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        })
        if (!user || !user.isActive) return null

        // 3. Verify password
        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        // 4. Return user object — attached to JWT by the jwt() callback below
        return {
          id:    user.id,
          email: user.email,
          name:  user.name,
          role:  user.role as Role,
        }
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    // Preserve the edge-safe authorized() callback from auth.config.ts
    ...authConfig.callbacks,

    // Persist id + role into the JWT token
    jwt({ token, user }) {
      if (user) {
        token.id   = user.id as string
        token.role = (user as { role: Role }).role
      }
      return token
    },

    // Expose id + role on the client-readable session object
    session({ session, token }) {
      if (session.user) {
        session.user.id   = token.id   as string
        session.user.role = token.role as Role
      }
      return session
    },
  },
})
