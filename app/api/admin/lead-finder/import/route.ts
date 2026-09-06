// @ts-nocheck
/**
 * Admin Lead Finder import - /api/admin/lead-finder/import
 *
 * POST { leads: LeadCandidate[], source?: string }
 *
 * Writes selected search results into CallLead. Dedupe is on osmKey
 * ("node/123456"), enforced by a unique index and skipDuplicates, so
 * re-importing the same town is safe and will never clobber a status or a
 * note somebody already typed against a venue.
 *
 * Platform admin only.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";

const MAX_IMPORT = 300;

function str(v: any, max = 300): string {
  return String(v ?? "").trim().slice(0, max);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const incoming = Array.isArray(body.leads) ? body.leads.slice(0, MAX_IMPORT) : [];
  if (!incoming.length) {
    return NextResponse.json({ error: "Nothing selected to import." }, { status: 400 });
  }

  const source = str(body.source, 120) || "lead-finder";

  const rows = incoming
    .filter((c: any) => str(c?.osmKey) && str(c?.name))
    .map((c: any) => ({
      osmType: str(c.osmType, 20) || "node",
      osmId: str(c.osmId, 40),
      osmKey: str(c.osmKey, 60),
      name: str(c.name, 200),
      category: str(c.category, 40) || "restaurant",
      phone: str(c.phone, 60) || null,
      email: str(c.email, 200) || null,
      address: str(c.address, 300),
      city: str(c.city, 120),
      region: str(c.region, 120),
      country: str(c.country, 8).toLowerCase(),
      lat: Number.isFinite(c.lat) ? Number(c.lat) : null,
      lng: Number.isFinite(c.lng) ? Number(c.lng) : null,
      facebook: str(c.facebook, 300) || null,
      instagram: str(c.instagram, 300) || null,
      source,
    }));

  if (!rows.length) {
    return NextResponse.json({ error: "Those rows were missing a name or an id." }, { status: 400 });
  }

  try {
    const result = await prisma.callLead.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return NextResponse.json({
      imported: result.count,
      skipped: rows.length - result.count,
      total: await prisma.callLead.count(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Import failed." }, { status: 500 });
  }
}
