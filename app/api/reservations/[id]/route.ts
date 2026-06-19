// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { customerName, customerEmail, customerPhone, partySize, date, time, notes, status } = body;

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

// DELETE — anonymises PII instead of hard-deleting.
// GDPR: right to erasure is balanced against legitimate interest (business records, Revenue audit trail).
// Financial data (partySize, date, time) is retained; personal data (name, email, phone) is wiped.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
