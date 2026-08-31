import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { previewSegment, renderMessage, MERGE_FIELDS } from "@/lib/crm/campaigns";
import { SEGMENTS, type SegmentCustomer } from "@/lib/crm/segments";
import { readLoyaltyConfig, tierName } from "@/lib/crm/loyalty";
import { getMessagingStatus } from "@/lib/messaging/config";
import { getCurrencySymbol, getLocale } from "@/lib/currency";

/**
 * Segment preview: how many guests match, how many are actually contactable,
 * and what the message will look like for a real guest.
 *
 * Matched and contactable are shown separately on purpose. A manager should see
 * "12 lapsed guests, 4 you may email" rather than silently losing eight people
 * to a consent flag they cannot see.
 */

function guard(session: any) {
  if (!session?.user?.businessId) return { error: "Unauthorized", status: 401 };
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return { error: "Forbidden", status: 403 };
  return null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const segment = typeof body.segment === "string" ? body.segment : "all";
  const channel = body.channel === "sms" ? "sms" : "email";
  const tag = typeof body.segmentTag === "string" && body.segmentTag.trim() ? body.segmentTag.trim() : null;
  const message = typeof body.message === "string" ? body.message : "";
  const subject = typeof body.subject === "string" ? body.subject : "";

  if (!SEGMENTS.some((s) => s.key === segment))
    return NextResponse.json({ error: "Unknown segment" }, { status: 400 });

  const [preview, business, cfg, messaging] = await Promise.all([
    previewSegment(businessId, segment, channel, tag),
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true, currency: true } }),
    readLoyaltyConfig(businessId),
    getMessagingStatus(businessId).catch(() => null),
  ]);

  // Render against the first matching guest so the merge fields show real shape.
  let rendered: { subject: string; body: string; guest: string | null } | null = null;
  if (message) {
    const first = preview.sample[0];
    const guest = first
      ? await prisma.customer.findFirst({
          where: { id: first.id, businessId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            birthday: true,
            gdprConsent: true,
            smsWhatsappConsent: true,
            loyaltyTier: true,
            loyaltyPoints: true,
            visitCount: true,
            totalSpend: true,
            averageSpend: true,
            lastVisitAt: true,
            favouriteDishes: true,
            tags: true,
          },
        })
      : null;

    // No guests yet? Show the template against a sample so the wording can
    // still be checked before anybody is in the segment.
    const sampleGuest: SegmentCustomer =
      guest ??
      ({
        id: "sample",
        name: "Sample Guest",
        email: null,
        phone: null,
        birthday: null,
        gdprConsent: true,
        smsWhatsappConsent: false,
        loyaltyTier: cfg.tiers[0]?.key ?? "bronze",
        loyaltyPoints: 120,
        visitCount: 6,
        totalSpend: 240,
        averageSpend: 40,
        lastVisitAt: new Date(Date.now() - 40 * 864e5),
        favouriteDishes: ["Fish and chips"],
        tags: [],
      } as SegmentCustomer);

    const ctx = {
      venueName: business?.name ?? "the venue",
      tierLabel: tierName(sampleGuest.loyaltyTier, cfg.tiers),
      currencySymbol: getCurrencySymbol((business?.currency as any) ?? "EUR"),
      locale: getLocale((business?.currency as any) ?? "EUR"),
    };

    rendered = {
      subject: subject ? renderMessage(subject, sampleGuest, ctx) : "",
      body: renderMessage(message, sampleGuest, ctx),
      guest: guest?.name ?? null,
    };
  }

  const smsReady = channel === "sms" ? Boolean(messaging?.configured && messaging?.hasSms) : true;

  return NextResponse.json({
    ...preview,
    rendered,
    mergeFields: MERGE_FIELDS,
    smsReady,
    smsNote:
      channel === "sms" && !smsReady
        ? "No Twilio credentials are saved for this venue, so SMS cannot be delivered yet. Drafts can still be built and reviewed. Add credentials in Settings to enable sending."
        : null,
  });
}
