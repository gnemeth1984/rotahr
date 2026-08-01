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

// Two separate limits. A guest who mistypes their email a few times must not be
// locked out, so validation failures only count toward the generous flood cap —
// the tighter cap applies to bookings that actually get created.
const MAX_REQUESTS_PER_IP_PER_HOUR = 30;
const MAX_BOOKINGS_PER_IP_PER_HOUR = 5;
const MAX_PENDING_PER_VENUE_PER_DAY = 50;

// Best-effort in-memory limiter. Serverless instances are ephemeral and not
// shared, so this thins abuse rather than eliminating it; the per-venue daily
// cap below is the real backstop.
const requestHits = new Map<string, number[]>();
const bookingHits = new Map<string, number[]>();

function tooMany(store: Map<string, number[]>, ip: string, max: number, record: boolean): boolean {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const recent = (store.get(ip) ?? []).filter((t) => t > hourAgo);
  if (record) {
    recent.push(now);
    store.set(ip, recent);
    if (store.size > 5000) store.clear(); // crude memory ceiling
  }
  return recent.length > max;
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
  // Flood guard — counts every request, including malformed ones.
  if (tooMany(requestHits, ip, MAX_REQUESTS_PER_IP_PER_HOUR, true)) {
    return NextResponse.json(
      { error: "Too many requests. Please call the venue directly." },
      { status: 429 }
    );
  }
  // Booking guard — checked without recording, so failed validation below
  // doesn't burn the guest's allowance. Recorded only on success.
  if (tooMany(bookingHits, ip, MAX_BOOKINGS_PER_IP_PER_HOUR, false)) {
    return NextResponse.json(
      { error: "You've made several booking requests already. Please call the venue directly." },
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

  // Only a real booking counts toward the tighter per-IP allowance.
  tooMany(bookingHits, ip, MAX_BOOKINGS_PER_IP_PER_HOUR, true);

  return NextResponse.json({ ok: true });
}
