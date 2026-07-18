import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  birthday: z.string().optional().nullable(),
  dietaryNotes: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  internalNotes: z.string().optional().nullable(),
  gdprConsent: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const tag = searchParams.get("tag") || "";
  const segment = searchParams.get("segment") || ""; // "at-risk" | "vip" | "new"
  const sort = searchParams.get("sort") || "lastVisit";
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 50;

  const where: any = {
    businessId: session.user.businessId,
    isAnonymised: false,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ];
  }

  if (tag) {
    where.tags = { has: tag };
  }

  // Fetch everything matching search/tag (not paginated yet) so stats and
  // smart-list segments are computed over the full matching set, not just
  // whatever page happens to be on screen.
  const customers = await prisma.customer.findMany({
    where,
    include: {
      reservations: {
        select: { id: true, date: true, status: true },
        orderBy: { date: "desc" },
      },
    },
    take: 5000,
    orderBy: { updatedAt: "desc" },
  });

  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  // Enrich with derived stats
  const enriched = customers.map((c) => {
    const visits = c.reservations.filter((r) => r.status !== "no-show" && r.status !== "cancelled");
    const noShows = c.reservations.filter((r) => r.status === "no-show");
    const lastVisit = visits[0]?.date ?? null;
    const totalVisits = visits.length;
    const isVip = c.tags.includes("VIP") || totalVisits >= 10;
    const isAtRisk = totalVisits >= 1 && (!!lastVisit ? now - new Date(lastVisit).getTime() > THIRTY_DAYS : false);
    const isNew = now - new Date(c.createdAt).getTime() <= THIRTY_DAYS;
    return {
      ...c,
      totalVisits,
      noShows: noShows.length,
      lastVisit,
      isVip,
      isAtRisk,
      isNew,
    };
  });

  // Aggregate stats over the full matching set (unaffected by segment filter,
  // so the stats bar always reflects "everyone matching search/tag")
  const stats = {
    total: enriched.length,
    vipCount: enriched.filter((c) => c.isVip).length,
    atRiskCount: enriched.filter((c) => c.isAtRisk).length,
    newCount: enriched.filter((c) => c.isNew).length,
    gdprConsentCount: enriched.filter((c) => c.gdprConsent).length,
    avgVisits: enriched.length
      ? Math.round((enriched.reduce((s, c) => s + c.totalVisits, 0) / enriched.length) * 10) / 10
      : 0,
  };

  // Apply smart-list segment filter (if any)
  let filtered = enriched;
  if (segment === "at-risk") filtered = enriched.filter((c) => c.isAtRisk);
  else if (segment === "vip") filtered = enriched.filter((c) => c.isVip);
  else if (segment === "new") filtered = enriched.filter((c) => c.isNew);

  // Sort
  const sorted = filtered.sort((a, b) => {
    if (sort === "visits") return b.totalVisits - a.totalVisits;
    if (sort === "noShows") return b.noShows - a.noShows;
    if (sort === "name") return a.name.localeCompare(b.name);
    // lastVisit (default)
    const da = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
    const db_ = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
    return db_ - da;
  });

  const total = sorted.length;
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  return NextResponse.json({ customers: paged, total, page, pageSize, stats });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;

  // Check for duplicate email
  if (data.email) {
    const existing = await prisma.customer.findFirst({
      where: { businessId: session.user.businessId, email: data.email, isAnonymised: false },
    });
    if (existing) return NextResponse.json({ error: "A customer with this email already exists", existing }, { status: 409 });
  }

  const customer = await prisma.customer.create({
    data: {
      businessId: session.user.businessId,
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      birthday: data.birthday ? new Date(data.birthday) : null,
      dietaryNotes: data.dietaryNotes ?? null,
      allergies: data.allergies ?? null,
      tags: data.tags ?? [],
      internalNotes: data.internalNotes ?? null,
      gdprConsent: data.gdprConsent ?? false,
      gdprConsentAt: data.gdprConsent ? new Date() : null,
    },
  });

  return NextResponse.json(customer, { status: 201 });
}
