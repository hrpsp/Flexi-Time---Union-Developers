import type { Metadata } from "next"
import { League_Spartan } from "next/font/google"
import { Toaster } from "sonner"
import { Providers } from "@/components/providers"
import "./globals.css"

const leagueSpartan = League_Spartan({
  subsets:  ["latin"],
  variable: "--font-league-spartan",
  weight:   ["300", "400", "500", "600", "700", "800", "900"],
  display:  "swap",
})

export const metadata: Metadata = {
  title:       "Flexi Time — HR Attendance",
  description: "Attendance & HR Management by Flexi IT Services",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={leagueSpartan.variable}>
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              style: { fontFamily: "var(--font-league-spartan)" },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
