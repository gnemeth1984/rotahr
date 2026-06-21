import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { prisma } from "@/lib/prisma"
import { lsFetch } from "@/lib/lemonsqueezy"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { business: true },
  })

  const subId = user?.business?.lsSubscriptionId
  if (!subId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 })
  }

  // Get customer portal URL from LS
  try {
    const data = await lsFetch(`/subscriptions/${subId}`)
    const portalUrl = data?.data?.attributes?.urls?.customer_portal
    if (!portalUrl) throw new Error("No portal URL")
    return NextResponse.json({ url: portalUrl })
  } catch (e) {
    return NextResponse.json({ error: "Failed to get portal URL" }, { status: 500 })
  }
}
