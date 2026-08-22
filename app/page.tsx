import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import LandingPage from "@/components/marketing/LandingPage"

/**
 * `/` is the canonical marketing page.
 *
 * History: `/` used to `redirect("/landing")`, which cost every visitor a full
 * round trip before a pixel rendered and put a redirect hop inside LCP. That
 * was fixed by rendering the component here instead — but it left the same
 * markup live on two URLs, which split the traffic (142 views on `/` vs 88 on
 * `/landing` in one 30-day window) and made every funnel measurement useless.
 *
 * Now there is exactly one marketing URL. `/` renders and owns the canonical;
 * `/landing` is a permanent redirect here (see `redirects()` in
 * next.config.mjs). The root domain wins because it is what people type, share
 * and link to.
 */
export const metadata = {
  alternates: { canonical: "/" },
}

export default async function RootPage() {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    redirect("/dashboard")
  }
  return <LandingPage />
}
