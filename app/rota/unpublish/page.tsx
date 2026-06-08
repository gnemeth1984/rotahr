import { supabase } from "@/lib/supabaseClient"
import { redirect } from "next/navigation"

export default async function UnpublishRota({ searchParams }) {
  const week = searchParams.week

  await supabase
    .from("rota_weeks")
    .update({ published: false })
    .eq("week_start", week)

  redirect(`/rota?week=${week}`)
}
