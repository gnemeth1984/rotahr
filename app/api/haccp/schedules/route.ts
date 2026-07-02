// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

function canEdit(role: string) {
  return role === "MANAGER" || role === "ADMIN";
}

// GET /api/haccp/schedules — list all schedules for the business
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const schedules = await prisma.hACCPSchedule.findMany({
    where: { businessId },
    orderBy: { checkType: "asc" },
  });

  return NextResponse.json({ schedules });
}

// POST /api/haccp/schedules — create or update a schedule for a check type (upsert)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const { checkType, times, daysOfWeek, active } = await req.json();

  if (!checkType) return NextResponse.json({ error: "checkType required" }, { status: 400 });
  if (!Array.isArray(times)) return NextResponse.json({ error: "times must be an array" }, { status: 400 });

  // Validate HH:mm format
  const validTimes = times.filter((t: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(t));

  const schedule = await prisma.hACCPSchedule.upsert({
    where: { businessId_checkType: { businessId, checkType } },
    create: {
      businessId,
      checkType,
      times: validTimes,
      daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : [],
      active: active !== false,
    },
    update: {
      times: validTimes,
      daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : [],
      ...(active !== undefined && { active }),
    },
  });

  return NextResponse.json({ schedule });
}

// DELETE /api/haccp/schedules?checkType=xxx — remove a schedule (reminders off for that type)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const { searchParams } = new URL(req.url);
  const checkType = searchParams.get("checkType");
  if (!checkType) return NextResponse.json({ error: "checkType required" }, { status: 400 });

  await prisma.hACCPSchedule.deleteMany({ where: { businessId, checkType } });

  return NextResponse.json({ ok: true });
}
