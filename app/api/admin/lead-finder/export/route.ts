// @ts-nocheck
/**
 * Admin Lead Finder CSV export - /api/admin/lead-finder/export
 *
 * GET ?status=  -> text/csv of the saved call list
 *
 * This is the format to print or drop into a phone. Every row is a venue with
 * no website, so the phone number is the asset.
 *
 * Platform admin only.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";
import { ATTRIBUTION } from "@/lib/leadfinder/overpass";

/** RFC 4180: wrap in quotes, double any inner quote. */
function cell(v: any): string {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = new URL(req.url).searchParams.get("status") ?? "";
  const where: any = {};
  if (status) where.status = status;

  const leads = await prisma.callLead.findMany({
    where,
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: 5000,
  });

  const header = [
    "Name", "Type", "Phone", "Email", "Address", "City", "Region", "Country",
    "Facebook", "Instagram", "Status", "Notes", "Source", "OSM",
  ];

  const lines = [
    header.map(cell).join(","),
    ...leads.map((l) =>
      [
        l.name, l.category, l.phone ?? "", l.email ?? "", l.address, l.city,
        l.region, l.country, l.facebook ?? "", l.instagram ?? "", l.status,
        l.notes ?? "", l.source ?? "",
        `https://www.openstreetmap.org/${l.osmKey}`,
      ].map(cell).join(","),
    ),
    "",
    cell(ATTRIBUTION + " - ODbL. Data may be incomplete or out of date."),
  ];

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rotahr-call-list-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
