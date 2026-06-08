"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export default function EditEmployeePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id

  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadEmployee() {
      const { data } = await supabase
        .from("employees")
        .select("*")
        .eq("id", id)
        .single()
      setEmployee(data)
      setLoading(false)
    }
    loadEmployee()
  }, [id])

  async function handleSubmit(e) {
    e.preventDefault()
    await supabase
      .from("employees")
      .update({
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        phone: employee.phone,
        role: employee.role,
        hourly_rate: employee.hourly_rate ? Number(employee.hourly_rate) : null,
      })
      .eq("id", id)

    router.push("/employees")
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Edit Employee</h1>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        {[
          ["First Name", "first_name"],
          ["Last Name", "last_name"],
          ["Email", "email"],
          ["Phone", "phone"],
          ["Role", "role"],
          ["Hourly Rate (€)", "hourly_rate"],
        ].map(([label, key]) => (
          <div key={key}>
            <label className="block mb-1">{label}</label>
            <input
              className="border p-2 rounded w-full"
              type={key === "hourly_rate" ? "number" : "text"}
              step={key === "hourly_rate" ? "0.01" : undefined}
              value={employee[key] || ""}
              onChange={(e) =>
                setEmployee({ ...employee, [key]: e.target.value })
              }
              required={["first_name", "last_name", "email", "role"].includes(
                key
              )}
            />
          </div>
        ))}

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
