import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { VARIANT_MAP, checkoutUrl } from "@/lib/lemonsqueezy"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { plan } = await req.json()
  if (!plan || !VARIANT_MAP[plan]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { business: true },
  })

  if (!user?.businessId) {
    return NextResponse.json({ error: "No business found" }, { status: 400 })
  }

  const variantId = VARIANT_MAP[plan]
  const url = checkoutUrl(variantId, session.user.email, user.businessId)

  return NextResponse.json({ url })
}
