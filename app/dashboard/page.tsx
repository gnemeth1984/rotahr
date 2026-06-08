import MinimalDashboard from "@/components/dashboard/MinimalDashboard"
import ModernDashboard from "@/components/dashboard/ModernDashboard"
import ColorfulDashboard from "@/components/dashboard/ColorfulDashboard"
import { supabase } from "@/lib/supabaseClient"

export default async function Dashboard() {
  // Get logged-in user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div className="p-6">Not logged in</div>
  }

  // Fetch theme from profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("theme")
    .eq("id", user.id)
    .single()

  const theme = profile?.theme || "minimal"

  // Load the correct dashboard
  if (theme === "modern") return <ModernDashboard />
  if (theme === "colorful") return <ColorfulDashboard />
  return <MinimalDashboard />
}
