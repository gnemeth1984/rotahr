"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from "next/navigation"

export default function AddEmployeePage() {
  const router = useRouter()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()

    await supabase.from("employees").insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      role,
      hourly_rate: hourlyRate ? Number(hourlyRate) : null,
    })

    router.push("/employees")
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Add Employee</h1>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <div>
          <label className="block mb-1">First Name</label>
          <input
            className="border p-2 rounded w-full"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block mb-1">Last Name</label>
          <input
            className="border p-2 rounded w-full"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block mb-1">Email</label>
          <input
            type="email"
            className="border p-2 rounded w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block mb-1">Phone</label>
          <input
            className="border p-2 rounded w-full"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-1">Role</label>
          <input
            className="border p-2 rounded w-full"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block mb-1">Hourly Rate (€)</label>
          <input
            type="number"
            step="0.01"
            className="border p-2 rounded w-full"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save Employee
        </button>
      </form>
    </div>
  )
}
