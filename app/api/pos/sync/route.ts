import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/pos/encrypt";
import { fetchLightspeedDayData, refreshLightspeedToken } from "@/lib/pos/lightspeed";
import { fetchSquareDayData, refreshSquareToken } from "@/lib/pos/square";

async function ensureFreshAccessToken(
  conn: {
    provider: string;
    accessToken: string;
    refreshToken: string | null;
    tokenExpiry: Date | null;
  },
  businessId: string
): Promise<string> {
  const accessToken = decryptToken(conn.accessToken);

  // Refresh if token expires within 5 minutes
  if (conn.tokenExpiry && conn.tokenExpiry.getTime() < Date.now() + 5 * 60 * 1000) {
    if (!conn.refreshToken) throw new Error("Token expired and no refresh token available");
    const rt = decryptToken(conn.refreshToken);

    if (conn.provider === "lightspeed") {
      const fresh = await refreshLightspeedToken(rt);
      await prisma.posConnection.update({
        where: { businessId },
        data: {
          accessToken: encryptToken(fresh.access_token),
          refreshToken: fresh.refresh_token ? encryptToken(fresh.refresh_token) : null,
          tokenExpiry: new Date(Date.now() + fresh.expires_in * 1000),
        },
      });
      return fresh.access_token;
    } else {
      const fresh = await refreshSquareToken(rt);
      await prisma.posConnection.update({
        where: { businessId },
        data: {
          accessToken: encryptToken(fresh.access_token),
          refreshToken: fresh.refresh_token ? encryptToken(fresh.refresh_token) : null,
          tokenExpiry: fresh.expires_at ? new Date(fresh.expires_at) : null,
        },
      });
      return fresh.access_token;
    }
  }

  return accessToken;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = session.user.businessId!;
  const conn = await prisma.posConnection.findUnique({ where: { businessId } });

  if (!conn) {
    return NextResponse.json({ error: "No POS connected" }, { status: 404 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  try {
    const accessToken = await ensureFreshAccessToken(conn, businessId);

    let snapshot;
    if (conn.provider === "lightspeed") {
      const accountId = conn.accountId;
      if (!accountId) throw new Error("Lightspeed account ID missing");
      snapshot = await fetchLightspeedDayData(accessToken, accountId, today);
    } else if (conn.provider === "square") {
      const locationId = conn.locationId;
      if (!locationId) throw new Error("Square location ID missing");
      snapshot = await fetchSquareDayData(accessToken, locationId, today);
    } else {
      throw new Error("Unknown provider");
    }

    await prisma.posSnapshot.upsert({
      where: { businessId_date: { businessId, date: today } },
      create: {
        businessId,
        date: today,
        provider: conn.provider,
        totalRevenue: snapshot.totalRevenue,
        totalCovers: snapshot.totalCovers,
        totalTransactions: snapshot.totalTransactions,
        hourlyData: snapshot.hourlyData,
        topItems: snapshot.topItems,
        rawMeta: { syncedAt: new Date().toISOString(), provider: conn.provider },
      },
      update: {
        totalRevenue: snapshot.totalRevenue,
        totalCovers: snapshot.totalCovers,
        totalTransactions: snapshot.totalTransactions,
        hourlyData: snapshot.hourlyData,
        topItems: snapshot.topItems,
        rawMeta: { syncedAt: new Date().toISOString(), provider: conn.provider },
      },
    });

    await prisma.posConnection.update({
      where: { businessId },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({ synced: true, snapshot });
  } catch (err) {
    console.error("[POS sync error]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
