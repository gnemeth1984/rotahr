import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLightspeedAuthUrl } from "@/lib/pos/lightspeed";
import { getSquareAuthUrl } from "@/lib/pos/square";
import crypto from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider } = params;
  // CSRF state: businessId + random nonce, signed
  const state = Buffer.from(
    JSON.stringify({ businessId: session.user.businessId, nonce: crypto.randomBytes(16).toString("hex") })
  ).toString("base64url");

  const base = process.env.NEXTAUTH_URL || "https://rotahr.com";
  const unavailable = (msg: string) =>
    NextResponse.redirect(
      `${base}/settings/pos?error=${encodeURIComponent(msg)}`
    );

  let url: string;
  if (provider === "lightspeed") {
    if (!process.env.LIGHTSPEED_CLIENT_ID || !process.env.LIGHTSPEED_CLIENT_SECRET) {
      return unavailable(
        "Lightspeed connections aren't switched on yet. Email sales@rotahr.com and we'll set you up."
      );
    }
    url = getLightspeedAuthUrl(state);
  } else if (provider === "square") {
    if (!process.env.SQUARE_APP_ID || !process.env.SQUARE_APP_SECRET) {
      return unavailable(
        "Square connections aren't switched on yet. Email sales@rotahr.com and we'll set you up."
      );
    }
    url = getSquareAuthUrl(state);
  } else {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  return NextResponse.redirect(url);
}
