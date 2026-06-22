// @ts-nocheck
// Public endpoint — no auth. Tracks landing page views.
// Called client-side from public pages only (landing, pricing, etc.)
import { NextRequest, NextResponse } from "next/server";
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

    await prisma.pageView.create({
      data: { path, referrer, sessionId, country, city, userAgent },
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Silent fail — never block the page
    return NextResponse.json({ ok: true });
  }
}
