export default function ModernDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-500">Overview of today’s operations</p>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-semibold mb-1">Staff On Duty</h2>
          <p className="text-3xl font-bold">3</p>
          <p className="text-xs text-gray-500 mt-1">Across all locations</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-semibold mb-1">Open Requests</h2>
          <p className="text-3xl font-bold text-amber-600">2</p>
          <p className="text-xs text-gray-500 mt-1">Awaiting approval</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-semibold mb-1">Upcoming Shifts</h2>
          <p className="text-3xl font-bold">5</p>
          <p className="text-xs text-gray-500 mt-1">Next 24 hours</p>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button className="border px-4 py-2 rounded-lg bg-gray-50">Add Shift</button>
          <button className="border px-4 py-2 rounded-lg bg-gray-50">Add Employee</button>
          <button className="border px-4 py-2 rounded-lg bg-gray-50">View Rota</button>
        </div>
      </section>
    </div>
  )
}
