import "./globals.css"
import { ReactNode } from "react"
import { Providers } from "@/components/shared/providers"

export const metadata = {
  title: "Rotahr",
  description: "Rota and HR management"
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
