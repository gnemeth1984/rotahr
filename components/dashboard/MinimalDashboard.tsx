export default function MinimalDashboard() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Staff On Duty</h2>
          <p className="text-gray-600">3 staff working today</p>
        </div>

        <div className="border p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Open Requests</h2>
          <p className="text-gray-600">2 pending approvals</p>
        </div>

        <div className="border p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Upcoming Shifts</h2>
          <p className="text-gray-600">5 shifts scheduled</p>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Quick Actions</h2>
        <div className="flex gap-3">
          <button className="border px-4 py-2 rounded">Add Shift</button>
          <button className="border px-4 py-2 rounded">Add Employee</button>
          <button className="border px-4 py-2 rounded">View Rota</button>
        </div>
      </div>
    </div>
  )
}
