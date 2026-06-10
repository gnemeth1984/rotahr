// app/shifts/page.tsx
import React from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"

type Employee = {
  id: string
  first_name?: string | null
  last_name?: string | null
}

type ShiftRow = {
  id: string
  week_id?: string | null
  day?: string | null
  start_time?: string | null
  end_time?: string | null
  break_minutes?: number | null
  role?: string | null
  employee_id?: string | null
  employees?: Employee[] | null
}

async function fetchShifts(): Promise<ShiftRow[]> {
  const { data, error } = await supabase
    .from("shifts")
    .select(
      `id, week_id, day, start_time, end_time, break_minutes, role, employee_id,
       employees(id, first_name, last_name)`
    )
    .order("day", { ascending: true })
    .order("start_time", { ascending: true })

  if (error) {
    console.error("Failed to load shifts", error)
    return []
  }
  return (data ?? []) as ShiftRow[]
}

export default async function ShiftsPage() {
  const shifts = await fetchShifts()

  return (
    <main className="p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shifts</h1>
        <Link href="/shifts/add" className="px-3 py-1 bg-green-600 text-white rounded">
          Add shift
        </Link>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 text-left">Day</th>
              <th className="border p-2 text-left">Time</th>
              <th className="border p-2 text-left">Role</th>
              <th className="border p-2 text-left">Employee</th>
              <th className="border p-2 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {shifts.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  No shifts found
                </td>
              </tr>
            )}

            {shifts.map((shift) => {
              // shift.employees may be an array (from Supabase relation) or null/undefined
              const empFromRelation =
                Array.isArray(shift.employees) && shift.employees.length > 0
                  ? shift.employees[0]
                  : undefined

              const employeeName = empFromRelation
                ? `${empFromRelation.first_name ?? ""} ${empFromRelation.last_name ?? ""}`.trim() || "Employee"
                : shift.employee_id
                ? shift.employee_id
                : "Unassigned"

              return (
                <tr key={shift.id}>
                  <td className="border p-2">{shift.day ?? "—"}</td>
                  <td className="border p-2">
                    {shift.start_time ?? "—"} — {shift.end_time ?? "—"}
                  </td>
                  <td className="border p-2">{shift.role ?? "General"}</td>
                  <td className="border p-2">{employeeName}</td>
                  <td className="border p-2">
                    <Link href={`/shifts/${shift.id}`} className="text-blue-600 hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </main>
  )
}

