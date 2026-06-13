import { prisma } from "@/lib/prisma"
import { format } from "date-fns"

export const dynamic = "force-dynamic"

export default async function ShiftsPage() {
  const shifts = await prisma.shift.findMany({
    include: { employee: true },
    orderBy: { date: "asc" }
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Shifts</h1>
      <table className="w-full text-sm border border-slate-800 rounded-lg overflow-hidden">
        <thead className="bg-slate-900">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Employee</th>
            <th className="px-3 py-2 text-left">Role</th>
            <th className="px-3 py-2 text-left">Published</th>
          </tr>
        </thead>
        <tbody>
          {shifts.map((s: any) => (
            <tr key={s.id} className="border-t border-slate-800">
              <td className="px-3 py-2">
                {format(s.date, "EEE dd MMM")}
              </td>
              <td className="px-3 py-2">
                {s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : "Unassigned"}
              </td>
              <td className="px-3 py-2">{s.role ?? "-"}</td>
              <td className="px-3 py-2">{s.published ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
