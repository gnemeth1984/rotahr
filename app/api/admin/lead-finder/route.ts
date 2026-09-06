// @ts-nocheck
/**
 * Admin Lead Finder - /api/admin/lead-finder
 *
 * POST   run a search        { place, types?, radiusKm?, limit? }  -> candidates
 * GET    list saved leads    ?status=&q=
 * PATCH  update a saved lead { id, status?, notes? }
 * DELETE drop a saved lead   { id }
 *
 * Platform admin only, same guard as /api/admin/founding.
 *
 * POST talks to two free volunteer-run services (Nominatim and Overpass) on
 * every call, so it carries a per-admin rate limit on top of the throttling
 * inside lib/leadfinder/overpass.ts. Getting Rotahr's IP banned from Overpass
 * would break this feature permanently and there is no appeal process.
 *
 * Saved leads live in CallLead, NOT OutreachLead. These venues have no email
 * (that is the entire point of the search) and OutreachLead.email is required
 * and unique. Do not bridge the two by inventing an info@ address.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";
import { findLeads, VENUE_TYPES, MAX_RESULTS } from "@/lib/leadfinder/overpass";

const CALL_STATUSES = [
  "new",
  "called",
  "no_answer",
  "callback",
  "not_interested",
  "signed",
];

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return { denied: NextResponse.json({ error: "Forbidden" }, { status: 403 }), email: "" };
  }
  return { denied: null, email: String(session.user.email) };
}

// ── Per-admin rate limit ─────────────────────────────────────────────────────
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 6;
const hits = new Map<string, number[]>();

function rateLimited(email: string): boolean {
  const now = Date.now();
  const recent = (hits.get(email) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(email, recent);
    return true;
  }
  recent.push(now);
  hits.set(email, recent);
  return false;
}

// ── POST: search ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { denied, email } = await guard();
  if (denied) return denied;

  if (rateLimited(email)) {
    return NextResponse.json(
      { error: "Too many searches in a row. Give OpenStreetMap a minute." },
      { status: 429 },
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request body." }, { status: 400 });
  }

  const place = String(body.place ?? "").trim();
  if (place.length < 2) {
    return NextResponse.json(
      { error: "Type a town, city or area to search." },
      { status: 400 },
    );
  }

  const types = Array.isArray(body.types)
    ? body.types.filter((t: string) => VENUE_TYPES.includes(t))
    : [...VENUE_TYPES];
  if (!types.length) {
    return NextResponse.json({ error: "Pick at least one venue type." }, { status: 400 });
  }

  try {
    const outcome = await findLeads({
      place,
      types,
      radiusKm: Number(body.radiusKm) || 8,
      limit: Math.min(Number(body.limit) || MAX_RESULTS, MAX_RESULTS),
    });

    // Flag the ones already in the call list so a repeat search does not look
    // like a pile of fresh leads.
    const keys = outcome.candidates.map((c) => c.osmKey);
    const existing = keys.length
      ? await prisma.callLead.findMany({
          where: { osmKey: { in: keys } },
          select: { osmKey: true },
        })
      : [];
    const saved = new Set(existing.map((e) => e.osmKey));

    return NextResponse.json({
      ...outcome,
      candidates: outcome.candidates.map((c) => ({ ...c, alreadySaved: saved.has(c.osmKey) })),
      alreadySavedCount: saved.size,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Search failed." },
      { status: 502 },
    );
  }
}

// ── GET: saved call list ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { denied } = await guard();
  if (denied) return denied;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim();

  const where: any = {};
  if (status && CALL_STATUSES.includes(status)) where.status = status;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  try {
    const [leads, grouped, total] = await Promise.all([
      prisma.callLead.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.callLead.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.callLead.count(),
    ]);

    const counts: Record<string, number> = {};
    for (const g of grouped) counts[g.status] = g._count._all;

    return NextResponse.json({ leads, counts, total });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not load leads." }, { status: 500 });
  }
}

// ── PATCH: update one ────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const { denied } = await guard();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing lead id." }, { status: 400 });

  const data: any = {};
  if (typeof body.notes === "string") data.notes = body.notes.slice(0, 4000);
  if (typeof body.status === "string") {
    if (!CALL_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    data.status = body.status;
    // Anything past "new" means somebody picked up the phone.
    if (body.status !== "new") data.calledAt = new Date();
  }
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const lead = await prisma.callLead.update({ where: { id }, data });
    return NextResponse.json({ lead });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Update failed." }, { status: 500 });
  }
}

// ── DELETE: drop one ─────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { denied } = await guard();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing lead id." }, { status: 400 });

  try {
    await prisma.callLead.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Delete failed." }, { status: 500 });
  }
}
