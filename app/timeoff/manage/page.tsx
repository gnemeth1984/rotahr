import { prisma } from "@/lib/prisma"
import { format } from "date-fns"

export const dynamic = "force-dynamic"

export default async function TimeOffManagePage() {
  const requests = await prisma.timeOffRequest.findMany({
    include: { employee: true },
    orderBy: { createdAt: "desc" }
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Time off requests</h1>
      <table className="w-full text-sm border border-slate-800 rounded-lg overflow-hidden">
        <thead className="bg-slate-900">
          <tr>
            <th className="px-3 py-2 text-left">Employee</th>
            <th className="px-3 py-2 text-left">Period</th>
            <th className="px-3 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r: any) => (
            <tr key={r.id} className="border-t border-slate-800">
              <td className="px-3 py-2">
                {r.employee
                  ? `${r.employee.firstName} ${r.employee.lastName}`
                  : "Unknown"}
              </td>
              <td className="px-3 py-2">
                {format(r.startDate, "dd MMM yyyy")} –{" "}
                {format(r.endDate, "dd MMM yyyy")}
              </td>
              <td className="px-3 py-2 capitalize">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
