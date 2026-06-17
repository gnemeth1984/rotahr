// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const templates = await prisma.shiftTemplate.findMany({
    where: { businessId },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }],
  });

  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const body = await req.json();

  const { employeeId, dayOfWeek, startHour, startMinute, endHour, endMinute, templateRole } = body;

  if (employeeId === undefined || dayOfWeek === undefined || startHour === undefined || endHour === undefined) {
    return NextResponse.json({ error: "employeeId, dayOfWeek, startHour, endHour required" }, { status: 400 });
  }

  const template = await prisma.shiftTemplate.create({
    data: {
      businessId,
      employeeId,
      dayOfWeek,
      startHour,
      startMinute: startMinute ?? 0,
      endHour,
      endMinute: endMinute ?? 0,
      role: templateRole ?? null,
      active: true,
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({ template });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.shiftTemplate.deleteMany({ where: { id, businessId } });

  return NextResponse.json({ ok: true });
}
