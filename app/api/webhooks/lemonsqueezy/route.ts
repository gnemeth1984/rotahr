import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { VARIANT_TO_PLAN, LS_WEBHOOK_SECRET } from "@/lib/lemonsqueezy"
import { triggerLeadConverted } from "@/lib/email/marketing"

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-signature") ?? ""

  // Verify HMAC signature
  const hmac = crypto
    .createHmac("sha256", LS_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex")

  if (hmac !== signature) {
    console.error("LS webhook: invalid signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  const eventName: string = payload.meta?.event_name ?? ""
  const data = payload.data
  const attrs = data?.attributes ?? {}
  const customData = payload.meta?.custom_data ?? attrs?.custom_data ?? {}

  const lsSubId: string = String(data?.id ?? "")
  const lsCustomerId: string = String(attrs.customer_id ?? "")
  const variantId: string = String(attrs.variant_id ?? "")
  const plan = VARIANT_TO_PLAN[variantId] ?? "starter"
  const status: string = attrs.status ?? "active"
  const renewsAt: Date | null = attrs.renews_at ? new Date(attrs.renews_at) : null
  const endsAt: Date | null = attrs.ends_at ? new Date(attrs.ends_at) : null

  // Resolve business — prefer custom_data.business_id, fallback to lsCustomerId match
  let businessId: string | undefined = customData?.business_id

  if (!businessId && lsCustomerId) {
    const biz = await prisma.business.findFirst({
      where: { lsCustomerId },
      select: { id: true },
    })
    businessId = biz?.id
  }

  console.log(`LS webhook: ${eventName} | businessId=${businessId} | plan=${plan} | status=${status}`)

  if (!businessId) {
    console.warn("LS webhook: could not resolve business — storing customer for future lookups")
    // Can't do anything useful without a businessId
    return NextResponse.json({ received: true })
  }

  switch (eventName) {
    case "subscription_created": {
      // Mark as converted in email marketing system (fire-and-forget)
      const owner = await prisma.user.findFirst({
        where: { businessId, role: { in: ["MANAGER", "ADMIN"] } },
        select: { email: true },
        orderBy: { createdAt: "asc" },
      })
      if (owner?.email) triggerLeadConverted(owner.email)
      // fall through to update subscription
    }
    case "subscription_updated":
    case "subscription_resumed":
    case "subscription_unpaused": {
      await prisma.business.update({
        where: { id: businessId },
        data: {
          lsSubscriptionId: lsSubId,
          lsCustomerId: String(lsCustomerId),
          lsVariantId: variantId,
          lsPlan: plan,
          lsStatus: status === "active" || status === "on_trial" ? "active" : status,
          lsRenewsAt: renewsAt,
          lsEndsAt: endsAt,
        },
      })
      break
    }

    case "subscription_cancelled": {
      await prisma.business.update({
        where: { id: businessId },
        data: {
          lsStatus: "cancelled",
          lsEndsAt: endsAt,
        },
      })
      break
    }

    case "subscription_expired": {
      await prisma.business.update({
        where: { id: businessId },
        data: {
          lsPlan: "none",
          lsStatus: "none",
          lsSubscriptionId: null,
          lsVariantId: null,
          lsRenewsAt: null,
          lsEndsAt: null,
        },
      })
      break
    }

    case "subscription_payment_failed": {
      await prisma.business.update({
        where: { id: businessId },
        data: { lsStatus: "past_due" },
      })
      break
    }

    case "subscription_payment_success":
    case "subscription_payment_recovered": {
      await prisma.business.update({
        where: { id: businessId },
        data: {
          lsStatus: "active",
          lsRenewsAt: renewsAt,
        },
      })
      break
    }

    default:
      console.log(`LS webhook: unhandled event ${eventName}`)
  }

  return NextResponse.json({ received: true })
}
