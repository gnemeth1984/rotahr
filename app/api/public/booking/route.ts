import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/public/booking
 *
 * Anonymous table-request endpoint used by public venue pages. Creates a
 * Reservation with status "pending" so it lands in the venue's Bookings page
 * for a human to confirm — it never auto-confirms or assigns a table.
 *
 * Abuse controls: honeypot field, per-IP in-memory rate limit, hard field
 * length caps, and a cap on pending requests per venue per day.
 */

const MAX_PER_IP_PER_HOUR = 5;
const MAX_PENDING_PER_VENUE_PER_DAY = 50;

// Best-effort in-memory limiter. Serverless instances are ephemeral and not
// shared, so this thins abuse rather than eliminating it; the per-venue daily
// cap below is the real backstop.
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const recent = (hits.get(ip) ?? []).filter((t) => t > hourAgo);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // crude memory ceiling
  return recent.length > MAX_PER_IP_PER_HOUR;
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Honeypot: hidden field, only bots fill it. Return success so they don't retry.
  if (str(body.company, 100)) {
    return NextResponse.json({ ok: true });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please call the venue directly." },
      { status: 429 }
    );
  }

  const slug = str(body.slug, 60);
  const name = str(body.name, 100);
  const phone = str(body.phone, 40);
  const email = str(body.email, 120);
  const notes = str(body.notes, 500);
  const dateStr = str(body.date, 10);
  const time = str(body.time, 5);
  const partySize = Number(body.partySize);
  const marketingConsent = body.marketingConsent === true;

  if (!slug || !name || !phone || !dateStr || !time) {
    return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ error: "Invalid date or time." }, { status: 400 });
  }
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 100) {
    return NextResponse.json({ error: "Invalid party size." }, { status: 400 });
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  // Booking date is interpreted in the venue's local day. Store midday UTC to
  // avoid the date shifting either way across timezone boundaries.
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (date < todayStart) {
    return NextResponse.json({ error: "Please choose a future date." }, { status: 400 });
  }
  const maxAhead = new Date();
  maxAhead.setFullYear(maxAhead.getFullYear() + 1);
  if (date > maxAhead) {
    return NextResponse.json({ error: "Please choose a date within the next year." }, { status: 400 });
  }

  const business = await prisma.business.findUnique({
    where: { publicSlug: slug },
    select: { id: true, publicPageEnabled: true, publicShowBooking: true },
  });
  if (!business || !business.publicPageEnabled || !business.publicShowBooking) {
    return NextResponse.json({ error: "Bookings aren't available here." }, { status: 404 });
  }

  // Backstop against a flood filling up the venue's bookings page.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pendingToday = await prisma.reservation.count({
    where: { businessId: business.id, status: "pending", createdAt: { gte: since } },
  });
  if (pendingToday >= MAX_PENDING_PER_VENUE_PER_DAY) {
    return NextResponse.json(
      { error: "We can't take more online requests right now. Please call us." },
      { status: 429 }
    );
  }

  await prisma.reservation.create({
    data: {
      businessId: business.id,
      customerName: name,
      customerPhone: phone,
      customerEmail: email || null,
      partySize,
      date,
      time,
      status: "pending", // must be confirmed by a human
      notes: notes || null,
      marketingConsent,
      createdByName: "Public page",
    },
  });

  return NextResponse.json({ ok: true });
}
