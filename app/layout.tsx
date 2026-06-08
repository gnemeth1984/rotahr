import "./globals.css"
import Sidebar from "@/components/Sidebar"

export const metadata = {
  title: "RotaHR",
  description: "HR & Rota Management System",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex">
        <Sidebar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
