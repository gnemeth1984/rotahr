import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/auth/rate-limit";
import { findClaimable } from "@/lib/public-page/claim";
import {
  recordMarketingConsent,
  MARKETING_CONSENT_TEXT_V1,
} from "@/lib/public-page/consent";

/**
 * Complete a claim: turn a prospect page into a real account owned by the
 * person who proved control of the venue's mailbox.
 *
 * The business already exists with its slug, page content and default venue, so
 * we attach an owner to it rather than creating anything new. Everything happens
 * in one transaction — a half-claimed business with no user would be
 * unrecoverable through the UI.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`claim-complete:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  let body: {
    token?: string;
    name?: string;
    email?: string;
    password?: string;
    marketingOptIn?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { token, name, email, password } = body;
  // Consent is a separate decision from claiming, so it is only ever true when
  // the checkbox was actually ticked. Anything other than a literal `true` —
  // absent, "false", "on", 1 — counts as no consent.
  const marketingOptIn = body.marketingOptIn === true;
  if (!token || !name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const business = await findClaimable({ token });
  if (!business) {
    return NextResponse.json(
      { error: "That claim link is no longer valid. Request a new one from the page." },
      { status: 410 }
    );
  }

  const normalisedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalisedEmail } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists. Sign in instead." },
      { status: 409 }
    );
  }

  const hashed = await bcrypt.hash(password, 12);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          name: name.trim(),
          email: normalisedEmail,
          password: hashed,
          // The claimer is the owner of their own business — same role a normal
          // signup gets. This is NOT platform admin.
          role: "MANAGER",
          businessId: business.id,
        },
      });

      await tx.business.update({
        where: { id: business.id },
        data: {
          // No longer a page we maintain on someone's behalf.
          publicProspect: false,
          // Burn the token so the link in the inbox is single-use.
          publicClaimToken: null,
          // We suppressed indexing while it was unverified; the owner controls
          // it from Settings now.
          publicNoIndex: false,
          onboardingComplete: false,
          // The takedown link is for pages we published unasked. Once the owner
          // holds the account, removal belongs behind their login.
          publicTakedownToken: null,
        },
      });
    });
  } catch (err) {
    console.error("[claim:complete]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  // Recorded after the claim succeeds and deliberately outside the transaction:
  // a failure to write the consent log must not roll back the account someone
  // just created. Only ever called when the box was ticked — no row is written
  // for a claim without consent, so silence is never mistaken for a yes.
  if (marketingOptIn) {
    try {
      await recordMarketingConsent({
        email: normalisedEmail,
        businessId: business.id,
        granted: true,
        source: "claim_form",
        consentText: MARKETING_CONSENT_TEXT_V1,
        ip,
        userAgent: req.headers.get("user-agent"),
      });
    } catch (err) {
      console.error("[claim:complete] consent log failed", err);
    }
  }

  // The conversion event that actually matters. Logged outside the transaction
  // for the same reason as the consent row: never roll back a real account over
  // a bookkeeping write.
  await prisma.activityLog
    .create({
      data: {
        businessId: business.id,
        action: "claim_completed",
        userName: name.trim(),
        details: { slug: business.slug },
      },
    })
    .catch((e) => console.error("[claim:complete] activity log failed", e));

  return NextResponse.json({ ok: true, slug: business.slug, email: normalisedEmail });
}
