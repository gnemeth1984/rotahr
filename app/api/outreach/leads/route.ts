export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../_auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") || 1));
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") || 50)));
  const status = sp.get("status");
  const country = sp.get("country");
  const search = sp.get("search")?.trim();

  const where: Prisma.OutreachLeadWhereInput = {};
  if (status && status !== "all") where.status = status;
  if (country && country !== "all") where.country = country;
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, leads] = await Promise.all([
    prisma.outreachLead.count({ where }),
    prisma.outreachLead.findMany({
      where,
      orderBy: [{ lastContacted: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    leads: leads.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      segment: l.segment,
      city: l.city,
      county: l.region,
      country: l.country,
      status: l.status,
      contactCount: l.contactCount,
      last_contacted: l.lastContacted ? l.lastContacted.toISOString() : null,
      created_at: l.createdAt.toISOString(),
    })),
  });
}
