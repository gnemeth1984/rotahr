// app/components/Nav.tsx
import Link from "next/link"

export default function Nav() {
  return (
    <nav className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-bold text-lg">Rotahr</Link>
          <Link href="/rota" className="text-sm text-gray-600 hover:text-gray-900">Rota</Link>
          <Link href="/shifts" className="text-sm text-gray-600 hover:text-gray-900">Shifts</Link>
          <Link href="/employees" className="text-sm text-gray-600 hover:text-gray-900">Employees</Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
          <Link href="/login" className="text-sm text-blue-600 hover:underline">Log in</Link>
        </div>
      </div>
    </nav>
  )
}
