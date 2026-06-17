// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const { searchParams } = new URL(req.url);

  // Managers can query any employee; staff only get their own
  let employeeId = searchParams.get("employeeId");
  const role = session.user.role;

  if (!employeeId || (role !== "MANAGER" && role !== "ADMIN")) {
    const me = await prisma.employee.findFirst({ where: { userId: session.user.id } });
    if (!me) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    employeeId = me.id;
  }

  const prefs = await prisma.availabilityPreference.findMany({
    where: { employeeId, businessId },
    orderBy: { dayOfWeek: "asc" },
  });

  return NextResponse.json({ prefs });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const body = await req.json();
  // body.prefs = array of { dayOfWeek, available, fromTime, toTime, note }
  // body.employeeId optional (managers can set for others)

  let employeeId = body.employeeId;
  const role = session.user.role;

  if (!employeeId || (role !== "MANAGER" && role !== "ADMIN")) {
    const me = await prisma.employee.findFirst({ where: { userId: session.user.id } });
    if (!me) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    employeeId = me.id;
  }

  const prefs: any[] = body.prefs ?? [];
  if (!Array.isArray(prefs) || prefs.length === 0) {
    return NextResponse.json({ error: "prefs array required" }, { status: 400 });
  }

  // Upsert each day
  const results = await Promise.all(
    prefs.map((p) =>
      prisma.availabilityPreference.upsert({
        where: { employeeId_dayOfWeek: { employeeId, dayOfWeek: p.dayOfWeek } },
        update: {
          available: p.available ?? true,
          fromTime: p.fromTime ?? null,
          toTime: p.toTime ?? null,
          note: p.note ?? null,
        },
        create: {
          employeeId,
          businessId,
          dayOfWeek: p.dayOfWeek,
          available: p.available ?? true,
          fromTime: p.fromTime ?? null,
          toTime: p.toTime ?? null,
          note: p.note ?? null,
        },
      })
    )
  );

  return NextResponse.json({ ok: true, count: results.length });
}
