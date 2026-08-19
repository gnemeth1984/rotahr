import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/auth/rate-limit";
import { sendEmail } from "@/lib/email/send";
import { findClaimable, issueClaimToken, claimEmailHtml } from "@/lib/public-page/claim";
import { SITE_URL } from "@/lib/seo/structured-data";

/**
 * Ask for a claim link for a prospect page.
 *
 * The response is identical whether or not a claimable page exists, and the
 * destination address is always the one already on file — never one supplied in
 * the request. See lib/public-page/claim.ts for the reasoning.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`claim-request:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  let slug: string | undefined;
  try {
    ({ slug } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Which page do you want to claim?" }, { status: 400 });
  }

  // Uniform response from here on, whatever we find.
  const uniform = NextResponse.json({
    ok: true,
    message:
      "If that page is claimable, we've emailed a claim link to the contact address we hold for the venue.",
  });

  const business = await findClaimable({ slug: slug.trim().toLowerCase() });
  if (!business) return uniform;

  // No contact address on file means email verification is impossible. Say
  // nothing here; the admin panel is where that gets handled manually.
  if (!business.contactEmail) {
    console.warn("[claim] no contact email on file for", business.slug);
    return uniform;
  }

  // Record the attempt before sending. Without this there was no way to tell
  // whether the claim funnel converted at all — the whole point of moving the
  // prompt to the top of the page is to compare before/after.
  await prisma.activityLog
    .create({
      data: {
        businessId: business.id,
        action: "claim_requested",
        userName: business.name,
        details: { slug: business.slug },
      },
    })
    .catch((e) => console.error("[claim] activity log failed", e));

  const token = await issueClaimToken(business.id);
  const result = await sendEmail({
    to: business.contactEmail,
    subject: `Claim your Rotahr page for ${business.name}`,
    html: claimEmailHtml({
      venueName: business.name,
      slug: business.slug,
      url: `${SITE_URL}/claim/${token}`,
    }),
    context: "claim-request",
  });

  // Log, don't leak. The requester learns nothing either way.
  if (!result.ok) console.error("[claim] send failed for", business.slug, result.error);

  return uniform;
}
