/**
 * Public founding member application — POST /api/founding/apply
 *
 * Unauthenticated on purpose. The entire point of the programme is to reach
 * venues that have not signed up, so requiring an account first would filter
 * out exactly the people it exists to attract.
 *
 * Rate limited on a hashed IP, same as /api/templates/request. The email
 * address is required here (unlike the template form) because an application we
 * cannot reply to is not an application.
 *
 * The notification to us is sent with sendEmailQuiet: a mail outage must not
 * lose the application, which is already committed to the database by then.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { isUnroutableAddress, sendEmailQuiet } from "@/lib/email/send";
import { TOTAL_SPOTS, foundingStatus } from "@/lib/marketing/founding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_IP_PER_DAY = 5;
const NOTIFY_TO = process.env.FOUNDING_NOTIFY_TO ?? "sales@rotahr.com";

function hashIp(req: Request): string | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  if (!ip) return null;
  const salt = process.env.NEXTAUTH_SECRET || "rotahr-founding";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const venueName = str(body.venueName, 200);
  const contactName = str(body.contactName, 150);
  const emailRaw = str(body.email, 200).toLowerCase();
  const phone = str(body.phone, 60) || null;
  const venueType = str(body.venueType, 100) || null;
  const currentTool = str(body.currentTool, 200) || null;
  const notes = str(body.notes, 2000) || null;

  const staffRaw = body.staffCount;
  let staffCount: number | null = null;
  if (typeof staffRaw === "number" && Number.isFinite(staffRaw)) {
    staffCount = Math.max(0, Math.min(Math.round(staffRaw), 10000));
  } else if (typeof staffRaw === "string" && staffRaw.trim()) {
    const n = Number.parseInt(staffRaw.trim(), 10);
    if (Number.isFinite(n)) staffCount = Math.max(0, Math.min(n, 10000));
  }

  if (venueName.length < 2) {
    return NextResponse.json({ error: "What is the venue called?" }, { status: 400 });
  }
  if (contactName.length < 2) {
    return NextResponse.json({ error: "What is your name?" }, { status: 400 });
  }
  const looksValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailRaw);
  if (!looksValid || isUnroutableAddress(emailRaw)) {
    return NextResponse.json(
      { error: "That email address doesn't look right." },
      { status: 400 },
    );
  }

  const ipHash = hashIp(req);
  if (ipHash) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await prisma.foundingApplication.count({
      where: { ipHash, createdAt: { gte: since } },
    });
    if (recent >= MAX_PER_IP_PER_DAY) {
      return NextResponse.json(
        { error: "We already have your details. We'll be in touch." },
        { status: 429 },
      );
    }
  }

  // Someone applying twice is far more likely to be an anxious operator than a
  // duplicate-stuffing bot, so this is idempotent rather than an error.
  const existing = await prisma.foundingApplication.findFirst({
    where: { email: emailRaw, status: { in: ["new", "contacted"] } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  let created: { id: string };
  try {
    created = await prisma.foundingApplication.create({
      data: {
        venueName,
        contactName,
        email: emailRaw,
        phone,
        venueType,
        staffCount,
        currentTool,
        notes,
        ipHash,
        userAgent: req.headers.get("user-agent")?.slice(0, 300) || null,
      },
      select: { id: true },
    });
  } catch (err) {
    console.error("[founding/apply]", err);
    return NextResponse.json(
      { error: "Could not save that. Try again in a moment." },
      { status: 500 },
    );
  }

  const status = await foundingStatus();
  const rows: Array<[string, string]> = [
    ["Venue", venueName],
    ["Contact", contactName],
    ["Email", emailRaw],
    ["Phone", phone ?? "-"],
    ["Type", venueType ?? "-"],
    ["Staff", staffCount === null ? "-" : String(staffCount)],
    ["Using now", currentTool ?? "-"],
    ["Notes", notes ?? "-"],
  ];

  await sendEmailQuiet({
    to: NOTIFY_TO,
    replyTo: emailRaw,
    subject: `Founding member application: ${venueName}`,
    context: "founding-apply",
    text:
      rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
      `\n\nSpots granted so far: ${status.taken} of ${TOTAL_SPOTS}` +
      `\nGrant it in Admin -> Founding.`,
    html:
      `<h2 style="font-family:sans-serif">Founding member application</h2>` +
      `<table style="font-family:sans-serif;border-collapse:collapse">` +
      rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${k}</td>` +
            `<td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`,
        )
        .join("") +
      `</table>` +
      `<p style="font-family:sans-serif;color:#64748b">Spots granted so far: ` +
      `${status.taken} of ${TOTAL_SPOTS}. Grant it in Admin &rarr; Founding.</p>`,
  });

  return NextResponse.json({ ok: true, id: created.id });
}
