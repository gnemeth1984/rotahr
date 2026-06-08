"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export default function EditShiftPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id

  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState([])

  const [employeeId, setEmployeeId] = useState("")
  const [date, setDate] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [role, setRole] = useState("")
  const [notes, setNotes] = useState("")
  const [breakMinutes, setBreakMinutes] = useState("")
  const [location, setLocation] = useState("")
  const [published, setPublished] = useState(false)

  useEffect(() => {
    async function loadData() {
      // Load employees
      const { data: empData } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .order("last_name", { ascending: true })
      setEmployees(empData || [])

      // Load shift
      const { data: shift } = await supabase
        .from("shifts")
        .select("*")
        .eq("id", id)
        .single()

      if (shift) {
        setEmployeeId(shift.employee_id || "")
        setDate(shift.shift_date)
        setStart(shift.start_time)
        setEnd(shift.end_time)
        setRole(shift.role || "")
        setNotes(shift.notes || "")
        setBreakMinutes(shift.break_minutes || "")
        setLocation(shift.location || "")
        setPublished(shift.published)
      }

      setLoading(false)
    }

    loadData()
  }, [id])

  async function handleSubmit(e) {
    e.preventDefault()

    await supabase
      .from("shifts")
      .update({
        employee_id: employeeId || null,
        shift_date: date,
        start_time: start,
        end_time: end,
        role,
        notes,
        break_minutes: breakMinutes ? Number(breakMinutes) : null,
        location,
        published,
      })
      .eq("id", id)

    router.push("/shifts")
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Edit Shift</h1>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <div>
          <label className="block mb-1">Employee</label>
          <select
            className="border p-2 rounded w-full"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1">Date</label>
          <input
            type="date"
            className="border p-2 rounded w-full"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block mb-1">Start Time</label>
          <input
            type="time"
            className="border p-2 rounded w-full"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block mb-1">End Time</label>
          <input
            type="time"
            className="border p-2 rounded w-full"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block mb-1">Break (minutes)</label>
          <input
            type="number"
            className="border p-2 rounded w-full"
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-1">Role</label>
          <input
            className="border p-2 rounded w-full"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-1">Location</label>
          <input
            className="border p-2 rounded w-full"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-1">Notes</label>
          <textarea
            className="border p-2 rounded w-full"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          <label>Published</label>
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save Changes
        </button>
      </form>
    </div>
  )
}
