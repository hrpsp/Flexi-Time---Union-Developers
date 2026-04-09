import { redirect } from "next/navigation"

// Root "/" within the dashboard group → /dashboard
export default function RootPage() {
  redirect("/dashboard")
}
