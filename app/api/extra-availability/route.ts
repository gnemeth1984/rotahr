// @ts-nocheck
// Extra shift availability — date-specific volunteer board
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// GET /api/extra-availability?from=YYYY-MM-DD&to=YYYY-MM-DD
// Managers: all staff for that range. Staff: own only.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ entries: [] });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const isManager = session.user.role === "MANAGER" || session.user.role === "ADMIN";

  let employeeId: string | undefined;
  if (!isManager) {
    const me = await prisma.employee.findFirst({ where: { userId: session.user.id } });
    if (!me) return NextResponse.json({ entries: [] });
    employeeId = me.id;
  }

  const entries = await prisma.extraAvailability.findMany({
    where: {
      businessId,
      ...(employeeId && { employeeId }),
      ...(from && to && {
        date: {
          gte: new Date(from),
          lte: new Date(to + "T23:59:59.999Z"),
        },
      }),
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ entries });
}

// POST /api/extra-availability  body: { date, fromTime?, toTime?, note? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const me = await prisma.employee.findFirst({ where: { userId: session.user.id } });
  if (!me) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const { date, fromTime, toTime, note } = await req.json();
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const entry = await prisma.extraAvailability.upsert({
    where: { employeeId_date: { employeeId: me.id, date: new Date(date) } },
    update: { fromTime: fromTime ?? null, toTime: toTime ?? null, note: note ?? null },
    create: {
      employeeId: me.id,
      businessId,
      date: new Date(date),
      fromTime: fromTime ?? null,
      toTime: toTime ?? null,
      note: note ?? null,
    },
  });

  return NextResponse.json({ entry });
}

// DELETE /api/extra-availability?date=YYYY-MM-DD
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.employee.findFirst({ where: { userId: session.user.id } });
  if (!me) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  await prisma.extraAvailability.deleteMany({
    where: { employeeId: me.id, date: new Date(date) },
  });

  return NextResponse.json({ ok: true });
}
