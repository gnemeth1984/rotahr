import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"

export default async function EmployeesPage() {
  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .order("last_name", { ascending: true })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>

        <Link
          href="/employees/add"
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Add Employee
        </Link>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Name</th>
            <th className="border p-2 text-left">Email</th>
            <th className="border p-2 text-left">Role</th>
            <th className="border p-2 text-left">Actions</th>
          </tr>
        </thead>

        <tbody>
          {employees?.map((emp) => (
            <tr key={emp.id}>
              <td className="border p-2">
                {emp.first_name} {emp.last_name}
              </td>
              <td className="border p-2">{emp.email}</td>
              <td className="border p-2">{emp.role}</td>
              <td className="border p-2">
                <Link
                  href={`/employees/${emp.id}`}
                  className="text-blue-600 underline"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}

          {employees?.length === 0 && (
            <tr>
              <td className="border p-2 text-center" colSpan={4}>
                No employees yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
