// app/rota/autoassign/route.ts
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

// Calculate hours from HH:MM strings
function hours(start: string, end: string, breakMin: number): number {
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)

  let diff = (eh + em / 60) - (sh + sm / 60)
  diff -= breakMin / 60

  return diff
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      week_id,
      mode, // "day" | "role" | "week"
      day,
      role,
      useTemplates // boolean
    } = body

    if (!week_id) {
      return NextResponse.json({ error: "Missing week_id" }, { status: 400 })
    }

    // Load employees
    const { data: employees, error: empErr } = await supabase
      .from("employees")
      .select("id, role, hourly_rate")

    if (empErr) throw empErr

    // Load availability
    const { data: availability, error: availErr } = await supabase
      .from("availability")
      .select("*")
      .eq("week_id", week_id)

    if (availErr) throw availErr

    // Load existing shifts
    const { data: shifts, error: shiftErr } = await supabase
      .from("shifts")
      .select("*")
      .eq("week_id", week_id)

    if (shiftErr) throw shiftErr

    // Load templates if needed
    let templates: any[] = []
    if (useTemplates) {
      const { data: tmpl, error: tmplErr } = await supabase
        .from("shift_templates")
        .select("*")

      if (tmplErr) throw tmplErr
      templates = tmpl
    }

    // Build employee hour totals
    const hourTotals: Record<string, number> = {}
    for (const emp of employees ?? []) {
      hourTotals[emp.id] = 0
    }

    for (const s of shifts ?? []) {
      // guard in case employee_id is undefined
      if (s.employee_id) {
        hourTotals[s.employee_id] = (hourTotals[s.employee_id] ?? 0) + hours(s.start_time, s.end_time, s.break_minutes)
      }
    }

    // Helper: find available employees (null-safe)
    function availableFor(day: string, role: string | null) {
      return (employees ?? []).filter(emp => {
        if (role && emp.role !== role) return false

        const avail = (availability ?? []).find(
          a => a.employee_id === emp.id && a.day === day
        )
        if (!avail) return false

        return avail.available === true
      })
    }

    // Helper: pick employee with lowest hours
    function pickEmployee(candidates: any[]) {
      return candidates.sort((a, b) => (hourTotals[a.id] ?? 0) - (hourTotals[b.id] ?? 0))[0]
    }

    const newShifts: any[] = []

    // Auto-assign logic
    if (mode === "day") {
      const dayShifts = (shifts ?? []).filter(s => s.day === day)

      for (const s of dayShifts) {
        if (s.employee_id) continue // don't overwrite

        const candidates = availableFor(day, s.role)
        if (candidates.length === 0) continue

        const chosen = pickEmployee(candidates)
        hourTotals[chosen.id] = (hourTotals[chosen.id] ?? 0) + hours(s.start_time, s.end_time, s.break_minutes)

        newShifts.push({
          id: s.id,
          employee_id: chosen.id
        })
      }
    }

    if (mode === "role") {
      const roleShifts = (shifts ?? []).filter(s => s.role === role)

      for (const s of roleShifts) {
        if (s.employee_id) continue

        const candidates = availableFor(s.day, role)
        if (candidates.length === 0) continue

        const chosen = pickEmployee(candidates)
        hourTotals[chosen.id] = (hourTotals[chosen.id] ?? 0) + hours(s.start_time, s.end_time, s.break_minutes)

        newShifts.push({
          id: s.id,
          employee_id: chosen.id
        })
      }
    }

    if (mode === "week") {
      for (const s of shifts ?? []) {
        if (s.employee_id) continue

        const candidates = availableFor(s.day, s.role)
        if (candidates.length === 0) continue

        const chosen = pickEmployee(candidates)
        hourTotals[chosen.id] = (hourTotals[chosen.id] ?? 0) + hours(s.start_time, s.end_time, s.break_minutes)

        newShifts.push({
          id: s.id,
          employee_id: chosen.id
        })
      }
    }

    // Apply updates
    for (const s of newShifts) {
      await supabase
        .from("shifts")
        .update({ employee_id: s.employee_id })
        .eq("id", s.id)
    }

    return NextResponse.json({ success: true, assigned: newShifts.length })
  } catch (err: any) {
    console.error("Auto-assign failed", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
