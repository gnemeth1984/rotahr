import { supabase } from "@/lib/supabaseClient"
import { redirect } from "next/navigation"

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default async function AvailabilityPage({ params }) {
  const employeeId = params.id

  const { data: availability } = await supabase
    .from("availability")
    .select("*")
    .eq("employee_id", employeeId)

  const map = Object.fromEntries(
    availability?.map((a) => [a.day_of_week, a]) ?? []
  )

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">Availability</h1>

      <form action="/employees/updateAvailability" method="post">
        <input type="hidden" name="employee_id" value={employeeId} />

        <div className="grid grid-cols-4 gap-4">
          {days.map((d, i) => {
            const row = map[i] ?? {}

            return (
              <div key={i} className="border p-3 rounded">
                <h2 className="font-semibold">{d}</h2>

                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    name={`available_${i}`}
                    defaultChecked={row.available ?? true}
                  />
                  Available
                </label>

                <div className="mt-2">
                  <label className="block text-sm">Start</label>
                  <input
                    type="time"
                    name={`start_${i}`}
                    defaultValue={row.start_time ?? ""}
                    className="border p-1 rounded w-full"
                  />
                </div>

                <div className="mt-2">
                  <label className="block text-sm">End</label>
                  <input
                    type="time"
                    name={`end_${i}`}
                    defaultValue={row.end_time ?? ""}
                    className="border p-1 rounded w-full"
                  />
                </div>
              </div>
            )
          })}
        </div>

        <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
          Save Availability
        </button>
      </form>
    </div>
  )
}
