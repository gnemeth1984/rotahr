export default function ColorfulDashboard() {
  return (
    <div className="p-6 space-y-6 bg-slate-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl p-4 bg-emerald-500">
          <h2 className="font-semibold mb-1">Staff On Duty</h2>
          <p className="text-3xl font-bold">3</p>
          <p className="text-xs mt-1 opacity-80">Live right now</p>
        </div>

        <div className="rounded-xl p-4 bg-amber-500">
          <h2 className="font-semibold mb-1">Open Requests</h2>
          <p className="text-3xl font-bold">2</p>
          <p className="text-xs mt-1 opacity-80">Need your decision</p>
        </div>

        <div className="rounded-xl p-4 bg-sky-500">
          <h2 className="font-semibold mb-1">Upcoming Shifts</h2>
          <p className="text-3xl font-bold">5</p>
          <p className="text-xs mt-1 opacity-80">Next 24 hours</p>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 rounded-lg bg-emerald-600">Add Shift</button>
          <button className="px-4 py-2 rounded-lg bg-sky-600">Add Employee</button>
          <button className="px-4 py-2 rounded-lg bg-amber-600">View Rota</button>
        </div>
      </div>
    </div>
  )
}