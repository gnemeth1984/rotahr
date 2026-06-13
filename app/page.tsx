import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const [employeeCount, shiftCount, pendingTimeOff] = await Promise.all([
    prisma.employee.count(),
    prisma.shift.count(),
    prisma.timeOffRequest.count({ where: { status: "pending" } })
  ])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-800 p-4">
          <div className="text-sm text-slate-400">Employees</div>
          <div className="text-3xl font-bold mt-2">{employeeCount}</div>
        </div>
        <div className="rounded-lg border border-slate-800 p-4">
          <div className="text-sm text-slate-400">Shifts</div>
          <div className="text-3xl font-bold mt-2">{shiftCount}</div>
        </div>
        <div className="rounded-lg border border-slate-800 p-4">
          <div className="text-sm text-slate-400">Pending time off</div>
          <div className="text-3xl font-bold mt-2">{pendingTimeOff}</div>
        </div>
      </div>
    </div>
  )
}
