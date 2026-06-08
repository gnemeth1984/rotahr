"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function Sidebar() {
  const pathname = usePathname()

  const links = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Employees", href: "/employees" },
    { name: "Shifts", href: "/shifts" },
    { name: "Rota", href: "/rota" },
    { name: "Requests", href: "/requests" },
    { name: "Settings", href: "/settings/theme" },
  ]

  return (
    <div className="w-64 h-screen border-r p-4 bg-white">
      <h1 className="text-xl font-bold mb-6">RotaHR</h1>

      <nav className="space-y-2">
        {links.map((link) => {
          const active = pathname.startsWith(link.href)

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-3 py-2 rounded ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {link.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
