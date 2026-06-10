// app/rota/unpublish/page.tsx
import React from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { supabase } from "@/lib/supabaseClient"

type SearchParams = Record<string, string | string[] | undefined>

type Props = {
  searchParams: SearchParams
}

export default async function UnpublishRota({ searchParams }: Props) {
  const rawWeek = searchParams.week
  const week = Array.isArray(rawWeek) ? rawWeek[0] : rawWeek ?? format(new Date(), "yyyy-MM-dd")

  try {
    const { error } = await supabase
      .from("rota_weeks")
      .upsert({
        week_id: week,
        published: false,
        published_at: null
      })

    if (error) throw error

    redirect(`/rota?week=${week}`)
  } catch (err: any) {
    console.error("Failed to unpublish rota week", err)

    return (
      <main className="p-6">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">Unpublish Rota</h1>
          <p className="text-sm text-gray-600">Week: <strong>{week}</strong></p>
        </header>

        <section className="p-4 border rounded bg-red-50">
          <h2 className="text-lg font-medium text-red-700">Unpublish failed</h2>
          <p className="mt-2 text-sm text-red-600">
            {err?.message ?? "An unknown error occurred while unpublishing the rota."}
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
