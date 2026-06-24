// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { triggerWelcomeEmail } from "@/lib/email/marketing";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let businessId = session.user.businessId;

  // Google OAuth new users: no business yet — return empty state so onboarding page
  // can show step 0 (business name) which will create the business on first POST.
  if (!businessId) {
    return NextResponse.json({
      business: null,
      steps: {
        businessName: false,
        departments: false,
        employees: false,
        hourlyRates: false,
        complete: false,
      },
    });
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      onboardingComplete: true,
      _count: {
        select: { departments: true, employees: true },
      },
    },
  });

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  // Derive step completion
  const steps = {
    businessName: !!business.name,
    departments: business._count.departments > 0,
    employees: business._count.employees > 0,
    hourlyRates: false,
    complete: business.onboardingComplete,
  };

  const empWithRate = await prisma.employee.findFirst({
    where: { businessId, hourlyRate: { not: null } },
  });
  steps.hourlyRates = !!empWithRate;

  return NextResponse.json({ business, steps });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { complete, name } = body;

  let businessId = session.user.businessId;

  // Google OAuth new users: no business yet — create one when they save a business name
  if (!businessId && name) {
    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: { name: name.trim(), onboardingComplete: false },
      });
      await tx.venue.create({
        data: {
          businessId: business.id,
          name: name.trim(),
          isDefault: true,
          timezone: "Europe/Dublin",
        },
      });
      await tx.user.update({
        where: { id: session.user.id },
        data: { businessId: business.id, role: "MANAGER" },
      });
      return business;
    });
    return NextResponse.json({ ok: true, business: result, newBusiness: true });
  }

  if (!businessId) {
    return NextResponse.json({ error: "No business associated with this account." }, { status: 400 });
  }

  const data: any = {};
  if (name) data.name = name;
  if (complete === true) data.onboardingComplete = true;

  const business = await prisma.business.update({
    where: { id: businessId },
    data,
  });

  // When onboarding completes, send welcome email
  if (complete === true && session.user.email) {
    const firstName = session.user.name?.split(" ")[0] ?? undefined;
    triggerWelcomeEmail({
      first_name: firstName,
      email: session.user.email,
      business_name: business.name,
    });
  }

  return NextResponse.json({ ok: true, business });
}
