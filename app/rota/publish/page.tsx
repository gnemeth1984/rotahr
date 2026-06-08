import { supabase } from "@/lib/supabaseClient"
import { redirect } from "next/navigation"

export default async function PublishRota({ searchParams }) {
  const week = searchParams.week

  await supabase.from("rota_weeks").upsert({
    week_start: week,
    published: true,
  })

  redirect(`/rota?week=${week}`)
}
