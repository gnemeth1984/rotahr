import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"

export default async function ShiftsPage() {
  const { data: shifts } = await supabase
    .from("shifts")
    .select(`
      id,
      shift_date,
      start_time,
      end_time,
      role,
      published,
      employees:employee_id (
        first_name,
        last_name
      )
    `)
    .order("shift_date", { ascending: true })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shifts</h1>

        <Link
          href="/shifts/add"
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Add Shift
        </Link>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Date</th>
            <th className="border p-2 text-left">Employee</th>
            <th className="border p-2 text-left">Start</th>
            <th className="border p-2 text-left">End</th>
            <th className="border p-2 text-left">Role</th>
            <th className="border p-2 text-left">Status</th>
            <th className="border p-2 text-left">Actions</th>
          </tr>
        </thead>

        <tbody>
          {shifts?.map((shift) => (
            <tr key={shift.id}>
              <td className="border p-2">
                {shift.shift_date}
              </td>

              <td className="border p-2">
                {shift.employees
                  ? `${shift.employees.first_name} ${shift.employees.last_name}`
                  : "Unassigned"}
              </td>

              <td className="border p-2">{shift.start_time}</td>
              <td className="border p-2">{shift.end_time}</td>
              <td className="border p-2">{shift.role || "-"}</td>

              <td className="border p-2">
                {shift.published ? (
                  <span className="text-green-600 font-semibold">Published</span>
                ) : (
                  <span className="text-gray-500">Draft</span>
                )}
              </td>

              <td className="border p-2">
                <Link
                  href={`/shifts/${shift.id}`}
                  className="text-blue-600 underline"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}

          {shifts?.length === 0 && (
            <tr>
              <td className="border p-2 text-center" colSpan={7}>
                No shifts yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
