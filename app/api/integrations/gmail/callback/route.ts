// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { exchangeCodeForTokens, getGoogleUserEmail } from "@/lib/google/gmail";

const BASE_URL = process.env.NEXTAUTH_URL || "https://rotahr.com";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, BASE_URL));

  if (error) {
    // e.g. user clicked "Cancel" on the Google consent screen
    return redirectTo(`/settings/email?error=${encodeURIComponent(error)}`);
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return redirectTo("/auth/signin");
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return redirectTo("/settings/email?error=forbidden");
  }

  const expectedState = req.cookies.get("gmail_oauth_state")?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectTo("/settings/email?error=invalid_state");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Happens if the user has connected before and Google didn't re-issue a
      // refresh_token — ask them to disconnect (revoke) and reconnect.
      return redirectTo("/settings/email?error=no_refresh_token");
    }
    const email = await getGoogleUserEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.emailConnection.upsert({
      where: { businessId: session.user.businessId },
      create: {
        businessId: session.user.businessId,
        provider: "gmail",
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        connectedById: session.user.id,
      },
      update: {
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        connectedById: session.user.id,
      },
    });

    const res = redirectTo("/settings/email?connected=1");
    res.cookies.delete("gmail_oauth_state");
    return res;
  } catch (e) {
    console.error("Gmail OAuth callback error:", e);
    return redirectTo("/settings/email?error=connection_failed");
  }
}
