// app/shifts/[id]/page.tsx
"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

type Employee = {
  id: string
  first_name?: string | null
  last_name?: string | null
}

type Shift = {
  id: string
  week_id?: string | null
  day?: string | null
  start_time?: string | null
  end_time?: string | null
  break_minutes?: number | null
  role?: string | null
  employee_id?: string | null
}

type Props = {
  params: { id: string }
}

export default function ShiftPage({ params }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<boolean>(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shift, setShift] = useState<Shift | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<string | "">("")

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data: empData, error: empErr } = await supabase
          .from("employees")
          .select("id, first_name, last_name")
          .order("last_name", { ascending: true })

        if (empErr) throw empErr
        setEmployees((empData ?? []) as Employee[])

        const { data: shiftData, error: shiftErr } = await supabase
          .from("shifts")
          .select("*")
          .eq("id", params.id)
          .single()

        if (shiftErr && shiftErr.code !== "PGRST116") throw shiftErr
        setShift((shiftData ?? null) as Shift | null)
        setSelectedEmployee((shiftData?.employee_id as string) ?? "")
      } catch (err) {
        console.error("Failed to load shift or employees", err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [params.id])

  async function saveAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (!shift) return

    try {
      setLoading(true)
      const { error } = await supabase
        .from("shifts")
        .update({ employee_id: selectedEmployee || null })
        .eq("id", shift.id)

      if (error) throw error
      router.refresh()
    } catch (err) {
      console.error("Failed to save assignment", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-6">Loading…</div>
  }

  if (!shift) {
    return <div className="p-6">Shift not found</div>
  }

  return (
    <main className="p-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold">Edit Shift</h1>
        <p className="text-sm text-gray-600">
          {shift.day} · {shift.start_time} — {shift.end_time}
        </p>
      </header>

      <form onSubmit={saveAssignment} className="space-y-4 max-w-md">
        <label className="block">
          <div className="text-sm font-medium mb-1">Assign employee</div>
          <select
            value={selectedEmployee}
            onChange={(ev) => setSelectedEmployee(ev.target.value)}
            className="w-full border rounded p-2"
          >
            <option value="">— Unassigned —</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {`${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() || emp.id}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-3">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded"
            disabled={loading}
          >
            Save
          </button>

          <button
            type="button"
            className="px-4 py-2 bg-gray-100 rounded"
            onClick={() => router.back()}
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  )
}
