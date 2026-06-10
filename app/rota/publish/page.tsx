// app/rota/publish/page.tsx
import React from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { supabase } from "@/lib/supabaseClient"

type SearchParams = Record<string, string | string[] | undefined>

type Props = {
  searchParams: SearchParams
}

export default async function PublishRota({ searchParams }: Props) {
  // Normalize week param to a single string (YYYY-MM-DD) or default to today
  const rawWeek = searchParams.week
  const week = Array.isArray(rawWeek) ? rawWeek[0] : rawWeek ?? format(new Date(), "yyyy-MM-dd")

  try {
    // Upsert a published flag for the week
    // NOTE: removed the second options argument ({ returning: "minimal" })
    // because your Supabase client typings do not accept it.
    const { error } = await supabase
      .from("rota_weeks")
      .upsert({
        week_id: week,
        published: true,
        published_at: new Date().toISOString()
      })

    if (error) throw error

    // Redirect back to the rota view for the published week
    redirect(`/rota?week=${week}`)
  } catch (err: any) {
    console.error("Failed to publish rota week", err)

    // Render a simple error page (server component)
    return (
      <main className="p-6">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">Publish Rota</h1>
          <p className="text-sm text-gray-600">Week: <strong>{week}</strong></p>
        </header>

        <section className="p-4 border rounded bg-red-50">
          <h2 className="text-lg font-medium text-red-700">Publish failed</h2>
          <p className="mt-2 text-sm text-red-600">
            {err?.message ?? "An unknown error occurred while publishing the rota."}
          </p>

          <div className="mt-4 flex gap-3">
            <Link href={`/rota?week=${week}`} className="px-3 py-1 bg-gray-100 rounded">
              Back to rota
            </Link>

            <Link href="/rota" className="px-3 py-1 bg-gray-100 rounded">
              All weeks
            </Link>
          </div>
        </section>
      </main>
    )
  }
}
