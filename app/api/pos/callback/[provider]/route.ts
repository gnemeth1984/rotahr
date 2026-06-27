import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/pos/encrypt";
import { exchangeLightspeedCode, getLightspeedCompanyId } from "@/lib/pos/lightspeed";
import { exchangeSquareCode, getSquareLocations } from "@/lib/pos/square";

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.redirect(new URL("/settings/pos?error=unauthorized", req.url));
  }

  const { provider } = params;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/settings/pos?error=${encodeURIComponent(error ?? "no_code")}`, req.url)
    );
  }

  const businessId = session.user.businessId!;

  try {
    if (provider === "lightspeed") {
      const tokens = await exchangeLightspeedCode(code);
      const accountId = await getLightspeedCompanyId(tokens.access_token);
      const expiry = new Date(Date.now() + tokens.expires_in * 1000);
      const encryptedRefresh = tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined;

      await prisma.posConnection.upsert({
        where: { businessId },
        create: {
          businessId,
          provider: "lightspeed",
          accessToken: encryptToken(tokens.access_token),
          refreshToken: encryptedRefresh,
          tokenExpiry: expiry,
          accountId,
        },
        update: {
          provider: "lightspeed",
          accessToken: encryptToken(tokens.access_token),
          refreshToken: encryptedRefresh,
          tokenExpiry: expiry,
          accountId,
          connectedAt: new Date(),
        },
      });
    } else if (provider === "square") {
      const tokens = await exchangeSquareCode(code);
      const locations = await getSquareLocations(tokens.access_token);
      const primaryLocationId = locations[0]?.id;
      const encryptedRefresh = tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined;

      await prisma.posConnection.upsert({
        where: { businessId },
        create: {
          businessId,
          provider: "square",
          accessToken: encryptToken(tokens.access_token),
          refreshToken: encryptedRefresh,
          tokenExpiry: tokens.expires_at ? new Date(tokens.expires_at) : undefined,
          locationId: primaryLocationId,
          accountId: tokens.merchant_id,
        },
        update: {
          provider: "square",
          accessToken: encryptToken(tokens.access_token),
          refreshToken: encryptedRefresh,
          tokenExpiry: tokens.expires_at ? new Date(tokens.expires_at) : undefined,
          locationId: primaryLocationId,
          accountId: tokens.merchant_id,
          connectedAt: new Date(),
        },
      });
    } else {
      return NextResponse.redirect(new URL("/settings/pos?error=unknown_provider", req.url));
    }

    return NextResponse.redirect(new URL("/settings/pos?connected=true", req.url));
  } catch (err) {
    console.error("[POS callback error]", err);
    return NextResponse.redirect(new URL("/settings/pos?error=token_exchange_failed", req.url));
  }
}
