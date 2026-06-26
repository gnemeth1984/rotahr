// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { UserRole as Role } from "@/types/roles";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const businessId = (session.user as any).businessId as string | undefined;
    const reservation = await prisma.reservation.findFirst({
      where: { id: params.id, ...(businessId ? { businessId } : {}) },
      include: {
        table: { select: { id: true, name: true, capacity: true } },
      },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ reservation });
  } catch (e) {
    console.error("[GET /api/reservations/[id]]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const isManager = userRole === Role.MANAGER || userRole === Role.ADMIN;

    const body = await req.json();
    const { customerName, customerEmail, customerPhone, partySize, date, time, notes, status } = body;

    // Non-managers can only cancel — not edit details
    if (!isManager) {
      const allowedKeys = Object.keys(body).filter(k => k !== "status");
      if (allowedKeys.length > 0 || (status && status !== "cancelled")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const reservation = await prisma.reservation.update({
      where: { id: params.id },
      data: {
        ...(customerName !== undefined ? { customerName } : {}),
        ...(customerEmail !== undefined ? { customerEmail: customerEmail || null } : {}),
        ...(customerPhone !== undefined ? { customerPhone: customerPhone || null } : {}),
        ...(partySize !== undefined ? { partySize: parseInt(partySize) } : {}),
        ...(date !== undefined ? { date: new Date(date) } : {}),
        ...(time !== undefined ? { time } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      include: {
        table: { select: { id: true, name: true, capacity: true } },
      },
    });

    return NextResponse.json({ reservation });
  } catch (e) {
    console.error("[PATCH /api/reservations/[id]]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — anonymises PII instead of hard-deleting (managers/admins only).
// GDPR: right to erasure is balanced against legitimate interest (business records, Revenue audit trail).
// Financial data (partySize, date, time) is retained; personal data (name, email, phone) is wiped.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const isManager = userRole === Role.MANAGER || userRole === Role.ADMIN;
    if (!isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.reservation.update({
      where: { id: params.id },
      data: {
        customerName: "[deleted]",
        customerEmail: null,
        customerPhone: null,
        notes: null,
        dietary: null,
        occasion: null,
        status: "cancelled",
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/reservations/[id]]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
