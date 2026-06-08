import { supabase } from "@/lib/supabaseClient"
import { redirect } from "next/navigation"

export async function POST(req: Request) {
  const form = await req.formData()
  const id = form.get("id") as string
  const status = form.get("status") as string

  await supabase
    .from("time_off_requests")
    .update({ status })
    .eq("id", id)

  redirect("/timeoff/manage")
}
