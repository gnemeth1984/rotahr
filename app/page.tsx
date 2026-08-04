import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
// Importing the /landing route's component rather than duplicating 400 lines of
// markup. Its own `metadata` export is ignored here; this file declares its own.
import LandingPage from "./landing/page"

/**
 * `/` used to `redirect("/landing")` for anonymous visitors, so everyone who
 * typed rotahr.com paid a full extra round trip before a single pixel rendered.
 * It also meant Lighthouse measured the site's front door with a redirect hop
 * included in LCP.
 *
 * Now `/` renders the landing page directly. `/landing` stays as the canonical
 * URL — it's what the sitemap, Search Console and every internal link use — so
 * the canonical tag below points there and the duplication costs nothing.
 */
export const metadata = {
  alternates: { canonical: "/landing" },
}

export default async function RootPage() {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    redirect("/dashboard")
  }
  return <LandingPage />
}
