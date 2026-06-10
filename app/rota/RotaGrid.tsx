// app/rota/RotaGrid.tsx
import React from "react"

export type Employee = {
  id: string
  name?: string
  first_name?: string
  last_name?: string
  role?: string
  hourly_rate?: number
}

export type Shift = {
  id: string
  week_id: string
  day: string
  start_time: string
  end_time: string
  break_minutes: number
  role?: string
  employee_id?: string | null
}

type Props = {
  weekStart: string
  shifts: Shift[]
  employees: Employee[]
}

export default function RotaGrid({ weekStart, shifts, employees }: Props) {
  // Group shifts by day for the week (simple grouping)
  const days = Array.from(
    new Set(shifts.map((s) => s.day).concat([weekStart]))
  ).sort()

  const findEmployeeName = (id?: string | null) => {
    if (!id) return "Unassigned"
    const e = employees.find((emp) => emp.id === id)
    if (!e) return "Unknown"

    const fallbackName = `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim()
    return e.name ?? (fallbackName || "Employee")
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {days.map((day) => (
          <div key={day} className="border rounded p-3 bg-white">
            <div className="text-sm text-gray-500 mb-2">{day}</div>

            <div className="space-y-2">
              {shifts
                .filter((s) => s.day === day)
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map((s) => (
                  <div
                    key={s.id}
                    className="p-2 border rounded flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {s.start_time} — {s.end_time}
                      </div>
                      <div className="text-xs text-gray-500">
                        {s.role ?? "General"} · Break {s.break_minutes}m
                      </div>
                    </div>

                    <div className="text-sm text-right">
                      <div className="font-medium">{findEmployeeName(s.employee_id)}</div>
                      <div className="text-xs text-gray-500">{s.employee_id ? "Assigned" : "Open"}</div>
                    </div>
                  </div>
                ))}

              {shifts.filter((s) => s.day === day).length === 0 && (
                <div className="text-sm text-gray-400">No shifts</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
