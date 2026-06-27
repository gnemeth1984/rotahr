import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conn = await prisma.posConnection.findUnique({
    where: { businessId: session.user.businessId! },
    select: {
      provider: true,
      connectedAt: true,
      lastSyncAt: true,
      locationId: true,
      accountId: true,
      tokenExpiry: true,
    },
  });

  if (!conn) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    provider: conn.provider,
    connectedAt: conn.connectedAt,
    lastSyncAt: conn.lastSyncAt,
    locationId: conn.locationId,
    accountId: conn.accountId,
    tokenExpiry: conn.tokenExpiry,
  });
}
