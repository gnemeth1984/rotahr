// app/employees/[id]/page.tsx
"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

type PageProps = {
  params: {
    id: string
  }
}

type Employee = {
  id: string
  first_name?: string
  last_name?: string
  name?: string
  role?: string
  email?: string
  hourly_rate?: number
}

export default function EmployeePage({ params }: PageProps) {
  const router = useRouter()
  const { id } = params

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load employee
  useEffect(() => {
    let mounted = true

    async function fetchEmployee() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("employees")
          .select("id, first_name, last_name, name, role, email, hourly_rate")
          .eq("id", id)
          .single()

        if (error) throw error
        if (mounted) setEmployee(data)
      } catch (err: any) {
        console.error("Failed to load employee", err)
        if (mounted) setError(err?.message ?? "Failed to load employee")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (id) fetchEmployee()
    return () => {
      mounted = false
    }
  }, [id])

  // Save employee
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const form = new FormData(e.currentTarget)
      const payload: Partial<Employee> = {
        first_name: form.get("first_name")?.toString() ?? undefined,
        last_name: form.get("last_name")?.toString() ?? undefined,
        name: form.get("name")?.toString() ?? undefined,
        role: form.get("role")?.toString() ?? undefined,
        email: form.get("email")?.toString() ?? undefined,
        hourly_rate: form.get("hourly_rate") ? Number(form.get("hourly_rate")) : undefined
      }

      const { error: upsertError } = await supabase
        .from("employees")
        .update(payload)
        .eq("id", id)

      if (upsertError) throw upsertError

      const { data } = await supabase
        .from("employees")
        .select("id, first_name, last_name, name, role, email, hourly_rate")
        .eq("id", id)
        .single()

      setEmployee(data)
    } catch (err: any) {
      console.error("Failed to save employee", err)
      setError(err?.message ?? "Failed to save employee")
    } finally {
      setLoading(false)
    }
  }

  // Delete employee
  async function handleDelete() {
    if (!confirm("Delete this employee?")) return
    setLoading(true)
    try {
      const { error: delErr } = await supabase.from("employees").delete().eq("id", id)
      if (delErr) throw delErr
      router.push("/employees")
    } catch (err: any) {
      console.error("Failed to delete employee", err)
      setError(err?.message ?? "Failed to delete employee")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">
          {employee ? employee.name ?? `${employee.first_name} ${employee.last_name}` : "Employee"}
        </h1>
        {loading && <div className="text-sm text-gray-500">Loading…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
      </header>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 max-w-xl">
        <label className="flex flex-col">
          <span className="text-sm">First name</span>
          <input name="first_name" defaultValue={employee?.first_name ?? ""} className="border px-2 py-1 rounded" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm">Last name</span>
          <input name="last_name" defaultValue={employee?.last_name ?? ""} className="border px-2 py-1 rounded" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm">Display name</span>
          <input name="name" defaultValue={employee?.name ?? ""} className="border px-2 py-1 rounded" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm">Role</span>
          <input name="role" defaultValue={employee?.role ?? ""} className="border px-2 py-1 rounded" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm">Email</span>
          <input name="email" defaultValue={employee?.email ?? ""} className="border px-2 py-1 rounded" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm">Hourly rate</span>
          <input
            name="hourly_rate"
            type="number"
            step="0.01"
            defaultValue={employee?.hourly_rate ?? ""}
            className="border px-2 py-1 rounded"
          />
        </label>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="px-3 py-1 bg-blue-600 text-white rounded">
            {loading ? "Saving…" : "Save"}
          </button>

          <button type="button" onClick={() => router.push("/employees")} className="px-3 py-1 bg-gray-200 rounded">
            Back
          </button>

          <button type="button" onClick={handleDelete} className="px-3 py-1 bg-red-100 rounded">
            Delete
          </button>
        </div>
      </form>
    </div>
  )
}
