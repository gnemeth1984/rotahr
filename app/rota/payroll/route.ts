// app/rota/payroll/route.ts
import { NextResponse } from "next/server"
import { format } from "date-fns"
import { supabase } from "@/lib/supabaseClient"

type Shift = {
  id: string
  week_id: string
  start_time: string // "HH:MM"
  end_time: string // "HH:MM"
  break_minutes: number | null
  employee_id?: string | null
}

type Employee = {
  id: string
  hourly_rate?: number | null
}

function hours(start: string, end: string, breakMin: number): number {
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  let diff = (eh + em / 60) - (sh + sm / 60)
  diff -= breakMin / 60
  return Math.max(0, diff)
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const week = searchParams.get("week") ?? format(new Date(), "yyyy-MM-dd")

    // Load shifts for the week (no generic on .from to avoid the "Expected 2 type arguments" error)
    const { data: shifts, error: shiftErr } = await supabase
      .from("shifts")
      .select("id, week_id, start_time, end_time, break_minutes, employee_id")
      .eq("week_id", week)

    if (shiftErr) throw shiftErr
    const safeShifts: Shift[] = shifts ?? []

    // Collect employee ids referenced by shifts
    const employeeIds = Array.from(
      new Set(safeShifts.map((s) => s.employee_id).filter(Boolean) as string[])
    )

    // Load employees (no generic on .from)
    const { data: employees, error: empErr } = await supabase
      .from("employees")
      .select("id, hourly_rate")
      .in("id", employeeIds.length ? employeeIds : ["-"])

    if (empErr) throw empErr
    const safeEmployees: Employee[] = employees ?? []

    // Map employee id -> hourly_rate
    const rateMap: Record<string, number> = {}
    for (const e of safeEmployees) {
      rateMap[e.id] = e.hourly_rate ?? 0
    }

    // Compute payroll totals per employee and overall
    const totals: Record<string, { hours: number; pay: number }> = {}
    let overallHours = 0
    let overallPay = 0

    for (const s of safeShifts) {
      const empId = s.employee_id
      if (!empId) continue

      const h = hours(s.start_time, s.end_time, s.break_minutes ?? 0)
      const rate = rateMap[empId] ?? 0
      const pay = h * rate

      totals[empId] = totals[empId] ?? { hours: 0, pay: 0 }
      totals[empId].hours += h
      totals[empId].pay += pay

      overallHours += h
      overallPay += pay
    }

    return NextResponse.json({
      week,
      overall: {
        hours: Number(overallHours.toFixed(2)),
        pay: Number(overallPay.toFixed(2))
      },
      byEmployee: totals
    })
  } catch (err: any) {
    console.error("Payroll route error", err)
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 })
  }
}
