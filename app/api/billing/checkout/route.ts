import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { prisma } from "@/lib/prisma"
import { VARIANT_MAP, LS_API_KEY, LS_STORE_ID } from "@/lib/lemonsqueezy"

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

  // Create a proper LS checkout with custom_data so webhook gets business_id
  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: session.user.email,
          custom: {
            business_id: user.businessId,
          },
        },
        product_options: {
          redirect_url: `${process.env.NEXTAUTH_URL}/settings/billing?success=1`,
        },
      },
      relationships: {
        store: {
          data: { type: "stores", id: LS_STORE_ID },
        },
        variant: {
          data: { type: "variants", id: variantId },
        },
      },
    },
  }

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LS_API_KEY}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("LS checkout error:", err)
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 })
  }

  const data = await res.json()
  const url = data?.data?.attributes?.url

  if (!url) {
    return NextResponse.json({ error: "No checkout URL returned" }, { status: 500 })
  }

  return NextResponse.json({ url })
}
