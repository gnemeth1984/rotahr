// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const businessId = (session.user as any).businessId as string | undefined;
    if (!businessId) {
      return NextResponse.json({ reservations: [] });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    const reservations = await prisma.reservation.findMany({
      where: {
        businessId,
        ...(date
          ? {
              date: {
                gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
                lte: new Date(new Date(date).setHours(23, 59, 59, 999)),
              },
            }
          : {}),
      },
      include: {
        table: { select: { id: true, name: true, capacity: true } },
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });

    return NextResponse.json({ reservations });
  } catch (e) {
    console.error("[GET /api/reservations]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const businessId = (session.user as any).businessId as string | undefined;
    if (!businessId) {
      return NextResponse.json({ error: "No business associated" }, { status: 400 });
    }

    const body = await req.json();
    const { customerName, customerEmail, customerPhone, partySize, date, time, notes } = body;

    if (!customerName || !partySize || !date || !time) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userId = (session.user as any).id as string | undefined;
    const userName = (session.user as any).name || (session.user as any).email || "Staff";

    const reservation = await prisma.reservation.create({
      data: {
        businessId,
        customerName,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        partySize: parseInt(partySize),
        date: new Date(date),
        time,
        notes: notes || null,
        status: "confirmed",
        createdById: userId || null,
        createdByName: userName,
      },
      include: {
        table: { select: { id: true, name: true, capacity: true } },
      },
    });

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/reservations]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
