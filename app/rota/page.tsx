// app/rota/page.tsx
import React from "react"
import RotaGrid from "./RotaGrid"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"

type SearchParams = Record<string, string | string[] | undefined>

type Props = {
  searchParams: SearchParams
}

type Employee = {
  id: string
  name?: string
  first_name?: string
  last_name?: string
  role?: string
  hourly_rate?: number
}

type Shift = {
  id: string
  week_id: string
  day: string
  start_time: string
  end_time: string
  break_minutes: number
  role?: string
  employee_id?: string | null
}

async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, name, first_name, last_name, role, hourly_rate")

  if (error) {
    console.error("Failed to load employees", error)
    return []
  }
  return data ?? []
}

async function fetchShifts(weekStart: string): Promise<Shift[]> {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("week_id", weekStart)

  if (error) {
    console.error("Failed to load shifts", error)
    return []
  }
  return data ?? []
}

function isoDateAddDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default async function RotaPage({ searchParams }: Props) {
  // Normalize week param to a single string (YYYY-MM-DD) or undefined
  const rawWeek = searchParams.week
  const weekStart = Array.isArray(rawWeek) ? rawWeek[0] : rawWeek ?? undefined

  // Default to today's date if none provided
  const defaultWeekIso = new Date().toISOString().slice(0, 10)
  const week = weekStart ?? defaultWeekIso

  // Server-side fetch data for the grid
  const [employees, shifts] = await Promise.all([fetchEmployees(), fetchShifts(week)])

  // Compute previous/next week links (7-day steps)
  const prevWeek = isoDateAddDays(week, -7)
  const nextWeek = isoDateAddDays(week, 7)

  // Basic stats
  const totalShifts = shifts.length
  const assignedShifts = shifts.filter(s => !!s.employee_id).length
  const unassignedShifts = totalShifts - assignedShifts

  return (
    <main className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rota</h1>
          <p className="text-sm text-gray-600">Week starting: <strong>{week}</strong></p>
        </div>

        <div className="flex gap-3 items-center">
          <Link href={`/rota?week=${prevWeek}`} className="px-3 py-1 bg-gray-100 rounded">
            ← Prev week
          </Link>

          <Link href={`/rota?week=${nextWeek}`} className="px-3 py-1 bg-gray-100 rounded">
            Next week →
          </Link>

          <form action={`/rota/autoassign`} method="post">
            <input type="hidden" name="week_id" value={week} />
            <input type="hidden" name="mode" value="week" />
            <button
              type="submit"
              className="px-3 py-1 bg-blue-600 text-white rounded"
            >
              Auto‑assign week
            </button>
          </form>

          <Link href="/rota/new-shift" className="px-3 py-1 bg-green-600 text-white rounded">
            Add shift
          </Link>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border rounded">
          <div className="text-sm text-gray-500">Employees</div>
          <div className="text-lg font-medium">{employees.length}</div>
        </div>

        <div className="p-4 border rounded">
          <div className="text-sm text-gray-500">Total shifts</div>
          <div className="text-lg font-medium">{totalShifts}</div>
        </div>

        <div className="p-4 border rounded">
          <div className="text-sm text-gray-500">Unassigned</div>
          <div className="text-lg font-medium text-red-600">{unassignedShifts}</div>
        </div>
      </section>

      <section>
        {/* RotaGrid should accept props: weekStart, shifts, employees */}
        <RotaGrid weekStart={week} shifts={shifts} employees={employees} />
      </section>
    </main>
  )
}
