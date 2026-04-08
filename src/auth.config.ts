/**
 * Edge-compatible auth config — NO Prisma, NO bcrypt.
 * Used exclusively by middleware.ts (runs on Edge runtime).
 * The full auth logic (user lookup + password check) lives in src/lib/auth.ts.
 */
import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"

export default {
  providers: [
    // Provider must be declared here for middleware to recognise the route,
    // but the actual `authorize` runs only in the Node.js context (lib/auth.ts).
    Credentials({}),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn  = !!auth?.user
      const { pathname } = request.nextUrl

      // Always allow NextAuth API routes
      if (pathname.startsWith("/api/auth")) return true

      const isAuthPage = pathname.startsWith("/login")

      // Redirect unauthenticated users to login
      if (!isLoggedIn && !isAuthPage) return false

      // Redirect authenticated users away from the login page
      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL("/dashboard", request.nextUrl))
      }

      return true
    },
  },
} satisfies NextAuthConfig
