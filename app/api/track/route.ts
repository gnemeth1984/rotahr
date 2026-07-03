// @ts-nocheck
// Tracks page views across the whole site — public marketing pages AND
// logged-in app usage. No auth required to call it, but if a session
// exists we attach userId/businessId server-side (never trust client input).
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const path = typeof body.path === "string" ? body.path.slice(0, 255) : "/";
    const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null;

    // Vercel geo headers
    const country = req.headers.get("x-vercel-ip-country") ?? null;
    const city = req.headers.get("x-vercel-ip-city") ?? null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    // Skip bots
    const ua = userAgent?.toLowerCase() ?? "";
    if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider") || ua.includes("headless")) {
      return NextResponse.json({ ok: true });
    }

    // Attach the logged-in user/business, if any — server-verified via session, never from the request body
    let userId: string | null = null;
    let businessId: string | null = null;
    try {
      const session = await getServerSession(authOptions);
      if (session?.user) {
        userId = (session.user as any).id ?? null;
        businessId = (session.user as any).businessId ?? null;
      }
    } catch {
      // ignore — treat as anonymous
    }

    await prisma.pageView.create({
      data: { path, referrer, sessionId, country, city, userAgent, userId, businessId },
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Silent fail — never block the page
    return NextResponse.json({ ok: true });
  }
}

