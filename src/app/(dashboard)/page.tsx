import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

// Root "/" within the dashboard group → /dashboard
export default function RootPage() {
  redirect("/dashboard")
}
