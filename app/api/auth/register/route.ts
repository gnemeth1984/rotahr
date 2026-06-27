// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { isRateLimited } from "@/lib/auth/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 registrations per IP per 15 minutes
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(`register:${ip}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { name, email, password, businessName } = await req.json();

    // Validate
    if (!name?.trim() || !email?.trim() || !password || !businessName?.trim()) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);

    // Create business + default venue + user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: businessName.trim(),
          onboardingComplete: false,
        },
      });

      // Create a default venue for the business
      await tx.venue.create({
        data: {
          businessId: business.id,
          name: businessName.trim(),
          isDefault: true,
          timezone: "Europe/Dublin",
        },
      });

      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase(),
          password: hashed,
          role: "MANAGER",
          businessId: business.id,
        },
      });

      return { user, business };
    });

    return NextResponse.json({
      ok: true,
      userId: result.user.id,
      businessId: result.business.id,
    });
  } catch (err: any) {
    console.error("[register]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
