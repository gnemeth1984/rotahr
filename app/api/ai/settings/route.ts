// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { UserRole as Role } from "@/types/roles";
import { z } from "zod";

const settingsSchema = z.object({
  bookingThresholdForStaffIncrease: z.number().int().min(1).max(500).optional(),
  kitchenRatio: z.number().int().min(1).max(100).optional(),
  floorRatio: z.number().int().min(1).max(100).optional(),
  minBarStaff: z.number().int().min(0).max(20).optional(),
  rotaWarningDaysAhead: z.number().int().min(1).max(30).optional(),
  autoFlagShortStaffedShifts: z.boolean().optional(),
  minStaffPerShift: z.number().int().min(1).max(50).optional(),
  priceChangeNotifyScope: z.enum(["managers", "all_staff", "none"]).optional(),
  priceChangeMessage: z.string().max(500).nullable().optional(),
});

async function requireManager(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = session.user.role as Role;
  if (role !== Role.ADMIN && role !== Role.MANAGER) return null;
  const businessId = (session.user as any).businessId as string | undefined;
  if (!businessId) return null;
  return { session, businessId };
}

// GET — return current settings (or defaults)
export async function GET(req: NextRequest) {
  const auth = await requireManager(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await prisma.aISettings.findUnique({
    where: { businessId: auth.businessId },
  });

  if (!settings) {
    // Return defaults without creating
    return NextResponse.json({
      settings: {
        bookingThresholdForStaffIncrease: 20,
        kitchenRatio: 20,
        floorRatio: 15,
        minBarStaff: 1,
        rotaWarningDaysAhead: 3,
        autoFlagShortStaffedShifts: true,
        minStaffPerShift: 2,
        priceChangeNotifyScope: "managers",
        priceChangeMessage: null,
      },
    });
  }

  return NextResponse.json({ settings });
}

// PATCH — upsert settings
export async function PATCH(req: NextRequest) {
  const auth = await requireManager(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const result = settingsSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid input", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const settings = await prisma.aISettings.upsert({
    where: { businessId: auth.businessId },
    update: result.data,
    create: {
      businessId: auth.businessId,
      ...result.data,
    },
  });

  return NextResponse.json({ settings });
}
