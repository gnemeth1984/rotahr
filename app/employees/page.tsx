import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function EmployeesPage() {
  const employees = await prisma.employee.findMany({
    orderBy: { lastName: "asc" }
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Employees</h1>
      <table className="w-full text-sm border border-slate-800 rounded-lg overflow-hidden">
        <thead className="bg-slate-900">
          <tr>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Email</th>
            <th className="px-3 py-2 text-left">Active</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e: any) => (
            <tr key={e.id} className="border-t border-slate-800">
              <td className="px-3 py-2">
                {e.firstName} {e.lastName}
              </td>
              <td className="px-3 py-2">{e.email}</td>
              <td className="px-3 py-2">{e.active ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
