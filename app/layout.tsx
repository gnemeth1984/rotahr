// app/layout.tsx
import "./globals.css"
import Nav from "./components/Nav"

export const metadata = { title: "Rotahr", description: "Rota management" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <Nav />
        <div>{children}</div>
      </body>
    </html>
  )
}
