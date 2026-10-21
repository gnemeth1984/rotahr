import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveVenueId } from "@/lib/venues/resolve";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Which providers are actually usable in this environment (credentials present).
  const available = {
    lightspeed: Boolean(
      process.env.LIGHTSPEED_CLIENT_ID && process.env.LIGHTSPEED_CLIENT_SECRET
    ),
    square: Boolean(process.env.SQUARE_APP_ID && process.env.SQUARE_APP_SECRET),
  };

  const conn = await prisma.posConnection.findUnique({
    where: { businessId: session.user.businessId! },
    select: {
      provider: true,
      connectedAt: true,
      lastSyncAt: true,
      locationId: true,
      accountId: true,
      tokenExpiry: true,
      venueId: true,
    },
  });

  const venues = await prisma.venue.findMany({
    where: { businessId: session.user.businessId!, active: true },
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  if (!conn) {
    return NextResponse.json({ connected: false, available, venues });
  }

  return NextResponse.json({
    connected: true,
    available,
    provider: conn.provider,
    connectedAt: conn.connectedAt,
    lastSyncAt: conn.lastSyncAt,
    locationId: conn.locationId,
    accountId: conn.accountId,
    tokenExpiry: conn.tokenExpiry,
    venueId: conn.venueId,
    // where the next sync will attribute takings (picked venue, else automatic)
    effectiveVenueId: conn.venueId ?? (await resolveVenueId(session.user.businessId!)),
    venues,
  });
}
