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

  const businessId = session.user.businessId;
  if (!businessId) {
    return NextResponse.json({ error: "No business associated with this account." }, { status: 400 });
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
    hourlyRates: false, // computed below
    complete: business.onboardingComplete,
  };

  // Check at least one employee has an hourly rate
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

  const businessId = session.user.businessId;
  if (!businessId) {
    return NextResponse.json({ error: "No business associated with this account." }, { status: 400 });
  }
  const body = await req.json();
  const { complete, name } = body;

  const data: any = {};
  if (name) data.name = name;
  if (complete === true) data.onboardingComplete = true;

  const business = await prisma.business.update({
    where: { id: businessId },
    data,
  });

  // When onboarding completes, send welcome email (covers credential signups)
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
