import { NextRequest, NextResponse } from "next/server";
import { isSuppressed, normaliseEmail, suppress } from "@/lib/email/suppression";

/**
 * One-click unsubscribe target for the `List-Unsubscribe-Post` header
 * (RFC 8058). Gmail and Outlook call this without ever loading the page, and
 * having it is part of what keeps bulk sending out of the spam folder.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  let email = url.searchParams.get("email") ?? "";

  if (!email) {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      email = typeof body?.email === "string" ? body.email : "";
    } else {
      const text = await req.text().catch(() => "");
      email = new URLSearchParams(text).get("email") ?? "";
    }
  }

  email = normaliseEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  await suppress({
    email,
    source: "unsubscribe_link",
    reason: "one-click (List-Unsubscribe-Post)",
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}

/**
 * Lets the outreach sender check a suppression before it sends. Guarded by the
 * same shared secret the outreach proxy uses.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.OUTREACH_API_SECRET || "rotahr-api-2026";
  const provided =
    req.headers.get("x-api-secret") ?? new URL(req.url).searchParams.get("secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = new URL(req.url).searchParams.get("email") ?? "";
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  return NextResponse.json({ email: normaliseEmail(email), suppressed: await isSuppressed(email) });
}
