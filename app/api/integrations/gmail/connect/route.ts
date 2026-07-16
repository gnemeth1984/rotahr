// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getGmailAuthUrl } from "@/lib/google/gmail";
import crypto from "crypto";

// GET /api/integrations/gmail/connect — kicks off the OAuth flow
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) {
    return NextResponse.redirect(new URL("/auth/signin", process.env.NEXTAUTH_URL || "https://rotahr.com"));
  }
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.redirect(
      new URL("/settings/email?error=forbidden", process.env.NEXTAUTH_URL || "https://rotahr.com")
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(getGmailAuthUrl(state));
  res.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });
  return res;
}
