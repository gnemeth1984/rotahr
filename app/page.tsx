// app/page.tsx
import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <header className="max-w-4xl mx-auto mb-8">
        <h1 className="text-3xl font-bold">Rotahr</h1>
        <p className="text-sm text-gray-600 mt-1">Quick links to the rota app</p>
      </header>

      <section className="max-w-4xl mx-auto grid gap-4 sm:grid-cols-2">
        <Link href="/rota" className="p-4 bg-white border rounded hover:shadow">
          <h2 className="font-semibold">Rota</h2>
          <p className="text-sm text-gray-500">View and manage weekly rotas</p>
        </Link>

        <Link href="/shifts" className="p-4 bg-white border rounded hover:shadow">
          <h2 className="font-semibold">Shifts</h2>
          <p className="text-sm text-gray-500">List and edit shifts</p>
        </Link>

        <Link href="/employees" className="p-4 bg-white border rounded hover:shadow">
          <h2 className="font-semibold">Employees</h2>
          <p className="text-sm text-gray-500">Manage employee records</p>
        </Link>

        <Link href="/settings/theme" className="p-4 bg-white border rounded hover:shadow">
          <h2 className="font-semibold">Settings</h2>
          <p className="text-sm text-gray-500">App settings and theme</p>
        </Link>
      </section>
    </main>
  )
}
