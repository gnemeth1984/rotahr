import { supabase } from "@/lib/supabaseClient"
import { redirect } from "next/navigation"

export async function POST(req) {
  const form = await req.formData()
  const employeeId = form.get("employee_id")

  const rows = []

  for (let i = 0; i < 7; i++) {
    rows.push({
      employee_id: employeeId,
      day_of_week: i,
      available: form.get(`available_${i}`) === "on",
      start_time: form.get(`start_${i}`) || null,
      end_time: form.get(`end_${i}`) || null,
    })
  }

  await supabase.from("availability").delete().eq("employee_id", employeeId)
  await supabase.from("availability").insert(rows)

  redirect(`/employees/${employeeId}`)
}
