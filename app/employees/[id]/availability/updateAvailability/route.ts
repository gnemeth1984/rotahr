// app/employees/[id]/availability/updateAvailability/route.ts
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

/**
 * POST handler to create or update an availability row.
 *
 * Expects a form POST with fields:
 * - employee_id (string)
 * - date (yyyy-MM-dd)
 * - available ("true" | "false")
 * - notes (optional string)
 *
 * Returns JSON { success: true, data } on success or an error object with appropriate status.
 */

export async function POST(req: Request) {
  try {
    const form = await req.formData()

    const employeeId = form.get("employee_id")?.toString() ?? ""
    const date = form.get("date")?.toString() ?? ""
    const availableRaw = form.get("available")?.toString()
    const notes = form.get("notes")?.toString() ?? null

    if (!employeeId || !date) {
      return NextResponse.json(
        { error: "Missing required fields: employee_id and date" },
        { status: 400 }
      )
    }

    const available = availableRaw === "true" || availableRaw === "1"

    // Upsert by employee_id + date
    const { data, error } = await supabase
      .from("availability")
      .upsert(
        {
          employee_id: employeeId,
          date,
          available,
          notes,
        },
        // Supabase client typing in your project expects a string here.
        // Provide a comma-separated string of columns to use for onConflict.
        { onConflict: "employee_id,date" }
      )
      .select()

    if (error) {
      console.error("Supabase upsert availability error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (err: any) {
    console.error("Unexpected error in availability POST:", err)
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 })
  }
}
