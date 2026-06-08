"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function ThemeSettings() {
  const [theme, setTheme] = useState("minimal")

  // Load current theme from Supabase
  useEffect(() => {
    async function loadTheme() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("theme")
        .eq("id", user.id)
        .single()

      if (profile?.theme) setTheme(profile.theme)
    }

    loadTheme()
  }, [])

  // Update theme in Supabase
  async function updateTheme(newTheme: string) {
    setTheme(newTheme)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    await supabase
      .from("profiles")
      .update({ theme: newTheme })
      .eq("id", user.id)
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Dashboard Theme</h1>
      <p className="text-gray-600">
        Choose how your Rotahr dashboard looks for your business.
      </p>

      <select
        value={theme}
        onChange={(e) => updateTheme(e.target.value)}
        className="border p-2 rounded"
      >
        <option value="minimal">Minimal</option>
        <option value="modern">Modern</option>
        <option value="colorful">Colorful</option>
      </select>
    </div>
  )
}
