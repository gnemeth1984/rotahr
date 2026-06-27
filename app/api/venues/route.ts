// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// GET /api/venues — list venues for business
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ venues: [] });

  const url = new URL(req.url);
  const withChecklists = url.searchParams.get("checklists") === "1";

  const venues = await prisma.venue.findMany({
    where: { businessId, active: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    ...(withChecklists && {
      include: {
        checklists: {
          include: { items: { orderBy: { order: "asc" } } },
          orderBy: { createdAt: "asc" as const },
        },
      },
    }),
  });
  return NextResponse.json({ venues });
}

// POST /api/venues — create venue
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const body = await req.json();
  const { name, address, geoLat, geoLng, geoRadius, timezone, isDefault } = body;

  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // If setting as default, unset others
  if (isDefault) {
    await prisma.venue.updateMany({ where: { businessId }, data: { isDefault: false } });
  }

  const venue = await prisma.venue.create({
    data: {
      businessId,
      name,
      address: address ?? null,
      geoLat: geoLat ?? null,
      geoLng: geoLng ?? null,
      geoRadius: geoRadius ?? 200,
      timezone: timezone ?? "Europe/Dublin",
      isDefault: isDefault ?? false,
    },
  });
  return NextResponse.json({ venue }, { status: 201 });
}
