// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { resolveGeofence } from "@/lib/geo/geofence";

// GET — return current geo settings for the business
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { geoLat: true, geoLng: true, geoRadius: true, name: true },
  });

  // The fence the server will actually enforce for this user (their venue's pin
  // if set, else the business pin), so the clock page checks the same thing.
  const me = await prisma.employee.findFirst({
    where: { userId: session.user.id, businessId },
    select: { venueId: true },
  });
  const fence = await resolveGeofence(businessId, me?.venueId);
  const effective = fence
    ? { geoLat: fence.lat, geoLng: fence.lng, geoRadius: fence.radius, source: fence.source }
    : { geoLat: null, geoLng: null, geoRadius: business?.geoRadius ?? 200, source: null };

  return NextResponse.json({ geo: business, effective });
}

// PATCH — update geo settings (managers/admins only)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const body = await req.json();
  const { geoLat, geoLng, geoRadius } = body;

  const updated = await prisma.business.update({
    where: { id: businessId },
    data: {
      geoLat: geoLat != null ? parseFloat(geoLat) : null,
      geoLng: geoLng != null ? parseFloat(geoLng) : null,
      geoRadius: geoRadius != null ? parseInt(geoRadius) : 200,
    },
    select: { geoLat: true, geoLng: true, geoRadius: true },
  });

  return NextResponse.json({ geo: updated });
}
