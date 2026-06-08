// app/rota/page.tsx
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"
import { startOfWeek, addDays, format } from "date-fns"
import RotaGrid from "./RotaGrid"

export default async function RotaPage({ searchParams }) {
  const params = await searchParams

  const weekStart = params.week
    ? new Date(params.week)
    : startOfWeek(new Date(), { weekStartsOn: 1 })

  const days = [...Array(7)].map((_, i) => addDays(weekStart, i))

  // Employees (with overtime fields)
  const { data: employeesRaw } = await supabase
    .from("employees")
    .select("*")
    .order("last_name")

  // Shifts
  const { data: shiftsRaw } = await supabase
    .from("shifts")
    .select("*")
    .gte("shift_date", format(weekStart, "yyyy-MM-dd"))
    .lte("shift_date", format(addDays(weekStart, 6), "yyyy-MM-dd"))

  // Availability
  const { data: availabilityRaw } = await supabase
    .from("availability")
    .select("*")

  // Templates
  const { data: templatesRaw } = await supabase
    .from("shift_templates")
    .select("*")
    .order("name")

  // Time-off (approved only for this week)
  const { data: timeOffRaw } = await supabase
    .from("time_off_requests")
    .select("*")
    .eq("status", "approved")

  // Publish status
  const { data: rotaWeek } = await supabase
    .from("rota_weeks")
    .select("*")
    .eq("week_start", format(weekStart, "yyyy-MM-dd"))
    .single()

  const isPublished = rotaWeek?.published ?? false

  const employees = employeesRaw ?? []
  const shifts = shiftsRaw ?? []
  const availability = availabilityRaw ?? []
  const templates = templatesRaw ?? []
  const timeOff = timeOffRaw ?? []
  // send days as ISO date strings (yyyy-MM-dd) for safe serialization
  const safeDays = days.map((d) => format(d, "yyyy-MM-dd"))

  const roles = ["All", ...new Set(employees.map((e) => e.role || "Unassigned"))]

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Weekly Rota</h1>

      {/* Week Navigation */}
      <div className="flex gap-4 items-center">
        <Link
          href={`/rota?week=${format(addDays(weekStart, -7), "yyyy-MM-dd")}`}
          className="px-3 py-1 bg-gray-200 rounded"
        >
          ← Previous
        </Link>

        <div className="font-semibold">
          Week of {format(weekStart, "dd MMM yyyy")}
        </div>

        <Link
          href={`/rota?week=${format(addDays(weekStart, 7), "yyyy-MM-dd")}`}
          className="px-3 py-1 bg-gray-200 rounded"
        >
          Next →
        </Link>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {isPublished ? (
          <>
            <span className="px-3 py-1 bg-green-200 text-green-800 rounded">
              Published
            </span>
            <Link
              href={`/rota/unpublish?week=${format(weekStart, "yyyy-MM-dd")}`}
              className="px-3 py-1 bg-red-500 text-white rounded"
            >
              Unpublish
            </Link>
          </>
        ) : (
          <Link
            href={`/rota/publish?week=${format(weekStart, "yyyy-MM-dd")}`}
            className="px-3 py-1 bg-blue-600 text-white rounded"
          >
            Publish Rota
          </Link>
        )}

        <Link
          href={`/rota/copy?week=${format(weekStart, "yyyy-MM-dd")}`}
          className="px-3 py-1 bg-purple-600 text-white rounded"
        >
          Copy Previous Week
        </Link>

        <Link
          href={`/rota/payroll?week=${format(weekStart, "yyyy-MM-dd")}`}
          className="px-3 py-1 bg-emerald-600 text-white rounded"
        >
          Export Payroll CSV
        </Link>

        <Link
          href={`/timeoff/request`}
          className="px-3 py-1 bg-orange-600 text-white rounded"
        >
          Request Time Off
        </Link>

        <Link
          href={`/timeoff/manage`}
          className="px-3 py-1 bg-gray-800 text-white rounded"
        >
          Manage Time Off
        </Link>
      </div>

      {/* GRID */}
      <RotaGrid
        employees={employees}
        shifts={shifts}
        days={safeDays}
        availability={availability}
        roles={roles}
        templates={templates}
        timeOff={timeOff}
      />
    </div>
  )
}
