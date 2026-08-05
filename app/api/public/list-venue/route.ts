import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import {
  createSelfListing,
  listingEmailHtml,
  looksLikeEmail,
  manageUrl,
} from "@/lib/public-page/self-list";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://rotahr.com";

/**
 * POST /api/public/list-venue - a venue asks to be listed.
 *
 * The response is deliberately identical in every outcome. Whether the venue is
 * new, already listed to a different address, or already a paying account, the
 * caller is told only "check your inbox". Anything more specific turns this into
 * a lookup for which venues we hold pages for, and for which of those are
 * unclaimed - which is exactly the set an attacker would want.
 */
export async function POST(req: NextRequest) {
  const generic = NextResponse.json({
    ok: true,
    message: "Check your inbox for a link to publish the page.",
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";

  const name = str(body.name, 120);
  const email = str(body.email, 200);
  const town = str(body.town, 300);
  const venueType = str(body.venueType, 60);
  const phone = str(body.phone, 40);
  const website = str(body.website, 300);
  // Bots fill hidden fields. Flag it, never silently discard - a real submission
  // wrongly judged a bot is a lost customer, and we can't tell them apart with
  // enough confidence to throw work away.
  const looksAutomated = str(body.nickname, 100).length > 0;

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Enter the venue name." }, { status: 400 });
  }
  if (!looksLikeEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Per-mailbox throttle. Cheap, and it caps how fast one address can generate
  // unpublished pages if the form is scripted.
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.business.count({
    where: { publicEmail: email.toLowerCase(), publicProspect: true, createdAt: { gte: since } },
  });
  if (recent >= 3) return generic;

  try {
    const created = await createSelfListing({ name, email, town, venueType, phone, website });
    if (!created) return generic;

    if (looksAutomated) {
      console.warn("[list-venue] honeypot filled - listing created but flagged: %s (%s)", name, email);
    }

    const url = manageUrl(created.token, SITE);
    const sent = await sendEmail({
      to: email,
      subject: `Publish your Rotahr page for ${created.listing.name}`,
      html: listingEmailHtml({
        venueName: created.listing.name,
        url,
        slug: created.listing.slug,
        site: SITE,
      }),
      context: "venue-self-listing",
    });

    // Resend never throws, so an unchecked call here would look like success and
    // leave the owner waiting for a mail that was never accepted.
    if (!sent.ok) {
      console.error("[list-venue] manage link email failed for %s: %s", email, sent.error);
      return NextResponse.json(
        { error: "We couldn't send the email. Try again shortly." },
        { status: 502 }
      );
    }

    return generic;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[list-venue] failed:", msg);
    // A slug clash is the one case worth naming - the submitter can fix it.
    if (/already taken/i.test(msg)) {
      return NextResponse.json(
        { error: "A page with that name already exists. Try adding the town." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
