import { NextRequest, NextResponse } from "next/server";
import { isRateLimited } from "@/lib/auth/rate-limit";
import { findTakedownTarget, applyTakedown } from "@/lib/public-page/takedown";

/**
 * Remove a page we published for a venue that never asked for one.
 *
 * POST, not GET. A GET would be followed by mail-scanning bots and link
 * previewers, which would delete pages nobody asked to delete — so the emailed
 * link opens a confirmation page and the button posts here.
 *
 * No login and no reply required: the whole point is that objecting is as easy
 * as one click, because that is the condition on which publishing the page
 * unasked is defensible in the first place.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`takedown:${ip}`, 20, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  let token: string | undefined;
  let reason: string | undefined;
  try {
    ({ token, reason } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const target = await findTakedownTarget(token);
  if (!target) {
    // Already removed, already claimed, or a stale link. Reported as success:
    // the page is not there, which is the outcome they asked for, and telling
    // them "invalid token" would read as a refusal.
    return NextResponse.json({ ok: true, alreadyGone: true });
  }

  try {
    await applyTakedown(target, { reason: typeof reason === "string" ? reason.slice(0, 2000) : null });
  } catch (err) {
    console.error("[takedown] failed", target.slug, err);
    return NextResponse.json(
      { error: "Something went wrong. Email sales@rotahr.com and we'll remove it by hand." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, name: target.name });
}
