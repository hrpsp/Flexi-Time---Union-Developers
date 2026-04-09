/**
 * Edge-compatible auth config.
 * Used by middleware.ts (Edge runtime — no Prisma, no bcrypt).
 * Full authorize logic lives in lib/auth.ts (Node runtime only).
 */
import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"

export default {
  providers: [
    // Provider must be declared here so middleware recognises /api/auth/* routes.
    // The actual authorize() callback runs only in the Node runtime (lib/auth.ts).
    Credentials({}),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl
      const isLoggedIn   = !!auth?.user

      // Always allow NextAuth's own API routes
      if (pathname.startsWith("/api/auth")) return true

      // Public routes
      if (pathname === "/login") {
        // Bounce already-authenticated users away from login
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", request.nextUrl))
        }
        return true
      }

      // Everything else requires a session
      return isLoggedIn
    },
  },
} satisfies NextAuthConfig
