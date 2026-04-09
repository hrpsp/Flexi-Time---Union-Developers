import NextAuth from "next-auth"
import authConfig from "@/lib/auth.config"

const { auth } = NextAuth(authConfig)

export default auth

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     *   - _next/static  (Next.js build assets)
     *   - _next/image   (Next.js image optimisation)
     *   - favicon.ico
     *   - public image files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
