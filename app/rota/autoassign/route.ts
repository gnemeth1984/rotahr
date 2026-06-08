import { supabase } from "@/lib/supabaseClient"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()
  const { mode, date, role, generateMissing, weekStart, weekEnd } = body

  // Load all required data
  const { data: employees } = await supabase.from("employees").select("*")
  const { data: shifts } = await supabase
    .from("shifts")
    .select("*")
    .gte("shift_date", weekStart)
    .lte("shift_date", weekEnd)

  const { data: templates } = await supabase
    .from("shift_templates")
    .select("*")

  const { data: availability } = await supabase
    .from("availability")
    .select("*")

  const { data: timeOff } = await supabase
    .from("time_off_requests")
    .select("*")
    .eq("status", "approved")

  // Helper: calculate hours
  function hours(start, end, breakMin) {
    const [sh, sm] = start.split(":").map(Number)
    const [eh, em] = end.split(":").map(Number)
    let diff = (eh + em / 60) - (sh + sm / 60)
    if (breakMin) diff -= breakMin / 60
    return diff
  }

  // Helper: check time-off
  function isBlocked(empId, d) {
    return timeOff.some(
      (t) =>
        t.employee_id === empId &&
        d >= t.start_date &&
        d <= t.end_date
    )
  }

  // Helper: check availability
  function isAvailable(empId, d, start, end) {
    const dow = new Date(d).getDay()
    const a = availability.find(
      (x) => x.employee_id === empId && x.day_of_week === dow
    )
    if (!a) return true
    if (!a.available) return false
    if (a.start_time && start < a.start_time) return false
    if (a.end_time && end > a.end_time) return false
    return true
  }

  // Helper: weekly hours
  function weeklyHours(empId) {
    return shifts
      .filter((s) => s.employee_id === empId)
      .reduce((sum, s) => sum + hours(s.start_time, s.end_time, s.break_minutes), 0)
  }

  // Helper: daily hours
  function dailyHours(empId, d) {
    return shifts
      .filter((s) => s.employee_id === empId && s.shift_date === d)
      .reduce((sum, s) => sum + hours(s.start_time, s.end_time, s.break_minutes), 0)
  }

  // Fair distribution sort
  function sortEmployees(d, start, end, role) {
    return employees
      .filter((e) => !isBlocked(e.id, d))
      .filter((e) => isAvailable(e.id, d, start, end))
      .filter((e) => !role || e.role === role)
      .sort((a, b) => {
        const wa = weeklyHours(a.id)
        const wb = weeklyHours(b.id)
        if (wa !== wb) return wa - wb
        const da = dailyHours(a.id, d)
        const db = dailyHours(b.id, d)
        return da - db
      })
  }

  const newShifts = []

  // MODE: DAY
  if (mode === "day") {
    const dayTemplates = templates.filter((t) => !role || t.role === role)

    for (const t of dayTemplates) {
      const existing = shifts.find(
        (s) =>
          s.shift_date === date &&
          s.start_time === t.start_time &&
          s.end_time === t.end_time &&
          s.role === t.role
      )

      if (!existing && !generateMissing) continue

      if (!existing && generateMissing) {
        const candidates = sortEmployees(date, t.start_time, t.end_time, t.role)
        if (candidates.length === 0) continue

        const emp = candidates[0]

        const { data } = await supabase
          .from("shifts")
          .insert({
            employee_id: emp.id,
            shift_date: date,
            start_time: t.start_time,
            end_time: t.end_time,
            break_minutes: t.break_minutes,
            role: t.role,
          })
          .select()
          .single()

        if (data) newShifts.push(data)
      }
    }
  }

  // MODE: ROLE
  if (mode === "role") {
    const roleTemplates = templates.filter((t) => t.role === role)

    for (let d = new Date(weekStart); d <= new Date(weekEnd); d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10)

      for (const t of roleTemplates) {
        const existing = shifts.find(
          (s) =>
            s.shift_date === ds &&
            s.start_time === t.start_time &&
            s.end_time === t.end_time &&
            s.role === t.role
        )

        if (!existing && !generateMissing) continue

        if (!existing && generateMissing) {
          const candidates = sortEmployees(ds, t.start_time, t.end_time, t.role)
          if (candidates.length === 0) continue

          const emp = candidates[0]

          const { data } = await supabase
            .from("shifts")
            .insert({
              employee_id: emp.id,
              shift_date: ds,
              start_time: t.start_time,
              end_time: t.end_time,
              break_minutes: t.break_minutes,
              role: t.role,
            })
            .select()
            .single()

          if (data) newShifts.push(data)
        }
      }
    }
  }

  // MODE: WEEK
  if (mode === "week") {
    for (let d = new Date(weekStart); d <= new Date(weekEnd); d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10)

      for (const t of templates) {
        const existing = shifts.find(
          (s) =>
            s.shift_date === ds &&
            s.start_time === t.start_time &&
            s.end_time === t.end_time &&
            s.role === t.role
        )

        if (!existing && !generateMissing) continue

        if (!existing && generateMissing) {
          const candidates = sortEmployees(ds, t.start_time, t.end_time, t.role)
          if (candidates.length === 0) continue

          const emp = candidates[0]

          const { data } = await supabase
            .from("shifts")
            .insert({
              employee_id: emp.id,
              shift_date: ds,
              start_time: t.start_time,
              end_time: t.end_time,
              break_minutes: t.break_minutes,
              role: t.role,
            })
            .select()
            .single()

          if (data) newShifts.push(data)
        }
      }
    }
  }

  return NextResponse.json({ newShifts })
}
