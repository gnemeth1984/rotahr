import { supabase } from "@/lib/supabaseClient"
import { format, addDays } from "date-fns"

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const week = searchParams.get("week")

  const weekStart = new Date(week)
  const weekEnd = addDays(weekStart, 6)

  // Load employees
  const { data: employees } = await supabase
    .from("employees")
    .select("*")

  // Load shifts
  const { data: shifts } = await supabase
    .from("shifts")
    .select("*")
    .gte("shift_date", format(weekStart, "yyyy-MM-dd"))
    .lte("shift_date", format(weekEnd, "yyyy-MM-dd"))

  function calculateHours(start, end, breakMinutes) {
    const [sh, sm] = start.split(":").map(Number)
    const [eh, em] = end.split(":").map(Number)
    const startDate = new Date(0, 0, 0, sh, sm)
    const endDate = new Date(0, 0, 0, eh, em)
    let diff = (endDate - startDate) / 1000 / 60 / 60
    if (breakMinutes) diff -= breakMinutes / 60
    return diff
  }

  let csv = "Employee,Hours,Rate,Total Pay\n"

  employees.forEach((emp) => {
    const empShifts = shifts.filter((s) => s.employee_id === emp.id)

    const totalHours = empShifts.reduce(
      (sum, s) =>
        sum + calculateHours(s.start_time, s.end_time, s.break_minutes),
      0
    )

    const rate = emp.hourly_rate ?? 0
    const totalPay = totalHours * rate

    csv += `${emp.first_name} ${emp.last_name},${totalHours.toFixed(
      2
    )},${rate.toFixed(2)},${totalPay.toFixed(2)}\n`
  })

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="payroll-${week}.csv"`,
    },
  })
}
