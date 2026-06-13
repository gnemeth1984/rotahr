import "./globals.css"
import { ReactNode } from "react"

export const metadata = {
  title: "Rotahr",
  description: "Rota and HR management"
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">Rotahr</div>
          <nav className="flex gap-4 text-sm">
            <a href="/" className="hover:underline">Dashboard</a>
            <a href="/employees" className="hover:underline">Employees</a>
            <a href="/shifts" className="hover:underline">Shifts</a>
            <a href="/rota" className="hover:underline">Rota</a>
            <a href="/timeoff/manage" className="hover:underline">Time off</a>
          </nav>
        </header>
        <main className="p-4">{children}</main>
      </body>
    </html>
  )
}
