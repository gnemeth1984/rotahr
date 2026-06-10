"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadEmployees() {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("first_name", { ascending: true })

      if (error) {
        console.error(error)
      } else {
        setEmployees(data || [])
      }

      setLoading(false)
    }

    loadEmployees()
  }, [])

  function maskPps(pps: string | null) {
    if (!pps) return ""
    if (pps.length <= 3) return "***"
    return "*".repeat(pps.length - 3) + pps.slice(-3)
  }

  if (loading) {
    return <div className="p-6">Loading employees…</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
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
          <tr className="bg-gray-100 text-left">
            <th className="p-2 border">Name</th>
            <th className="p-2 border">Email</th>
            <th className="p-2 border">Phone</th>
            <th className="p-2 border">Role</th>
            <th className="p-2 border">PPS Number</th>
            <th className="p-2 border">Hourly Rate (€)</th>
          </tr>
        </thead>

        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id} className="border-b">
              <td className="p-2 border">
                {emp.first_name} {emp.last_name}
              </td>
              <td className="p-2 border">{emp.email}</td>
              <td className="p-2 border">{emp.phone || "-"}</td>
              <td className="p-2 border">{emp.role}</td>
              <td className="p-2 border font-mono">
                {maskPps(emp.pps_number)}
              </td>
              <td className="p-2 border">
                {emp.hourly_rate ? emp.hourly_rate.toFixed(2) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
