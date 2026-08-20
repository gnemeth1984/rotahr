/**
 * Public template request endpoint — POST /api/templates/request
 *
 * Unauthenticated on purpose: the whole /templates library is ungated, and the
 * request form is the only thing we ask for in return. Rate limited on a hashed
 * IP so one bored visitor can't fill the table, and the email field stays
 * optional because the request itself is useful even with nobody to reply to.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { isUnroutableAddress } from "@/lib/email/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_IP_PER_DAY = 8;

function hashIp(req: Request): string | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  if (!ip) return null;
  const salt = process.env.NEXTAUTH_SECRET || "rotahr-templates";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function POST(req: Request) {
  let body: { request?: string; email?: string; venue?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const request = (body.request || "").trim();
  const emailRaw = (body.email || "").trim().toLowerCase();
  const venueType = (body.venue || "").trim().slice(0, 200) || null;

  if (request.length < 3) {
    return NextResponse.json(
      { error: "Tell us which template you need." },
      { status: 400 },
    );
  }
  if (request.length > 1000) {
    return NextResponse.json(
      { error: "That's a bit long — keep it under 1000 characters." },
      { status: 400 },
    );
  }

  // An address we can't mail is worse than no address: it looks like a promise
  // we can keep and then hard-bounces off the sending domain.
  let email: string | null = null;
  if (emailRaw) {
    const looksValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailRaw);
    if (!looksValid || isUnroutableAddress(emailRaw)) {
      return NextResponse.json(
        { error: "That email address doesn't look right." },
        { status: 400 },
      );
    }
    email = emailRaw.slice(0, 200);
  }

  const ipHash = hashIp(req);
  if (ipHash) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await prisma.templateRequest.count({
      where: { ipHash, createdAt: { gte: since } },
    });
    if (recent >= MAX_PER_IP_PER_DAY) {
      return NextResponse.json(
        { error: "That's plenty for today — thanks. Try again tomorrow." },
        { status: 429 },
      );
    }
  }

  try {
    await prisma.templateRequest.create({
      data: {
        request,
        email,
        venueType,
        ipHash,
        userAgent: req.headers.get("user-agent")?.slice(0, 300) || null,
      },
    });
  } catch (err) {
    console.error("[templates/request]", err);
    return NextResponse.json(
      { error: "Could not save that. Try again in a moment." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
