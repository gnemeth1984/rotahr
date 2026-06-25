import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { UserRole as Role } from "@/types/roles";

function canEdit(role: string, permissions: string[]) {
  return role === Role.ADMIN || role === Role.MANAGER || permissions.includes("menu_planning");
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get("weekStart");

  if (weekStart) {
    const plan = await prisma.weeklyMenuPlan.findUnique({
      where: {
        businessId_weekStart: {
          businessId: session.user.businessId,
          weekStart: new Date(weekStart),
        },
      },
    });
    return NextResponse.json({ plan });
  }

  const plans = await prisma.weeklyMenuPlan.findMany({
    where: { businessId: session.user.businessId },
    orderBy: { weekStart: "desc" },
    take: 12,
  });
  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role, session.user.permissions ?? []))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { weekStart, planData } = await req.json();
  if (!weekStart || !planData) return NextResponse.json({ error: "weekStart and planData required" }, { status: 400 });

  const plan = await prisma.weeklyMenuPlan.upsert({
    where: {
      businessId_weekStart: {
        businessId: session.user.businessId,
        weekStart: new Date(weekStart),
      },
    },
    create: {
      businessId: session.user.businessId,
      weekStart: new Date(weekStart),
      planData,
    },
    update: { planData },
  });

  return NextResponse.json({ plan });
}
