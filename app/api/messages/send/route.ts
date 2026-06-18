// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/services/appNotification.service";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const { recipientId, body } = await req.json();

  if (!recipientId || !body?.trim()) {
    return NextResponse.json({ error: "recipientId and body required" }, { status: 400 });
  }

  const me = await prisma.employee.findFirst({ where: { userId: session.user.id } });
  if (!me) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const message = await prisma.message.create({
    data: { businessId, senderId: me.id, recipientId, body: body.trim() },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true } },
      recipient: { select: { id: true, firstName: true, lastName: true, userId: true } },
    },
  });

  // Notify recipient if they have a user account
  if (message.recipient.userId) {
    await createNotification({
      userId: message.recipient.userId,
      type: "message",
      title: `New message from ${me.firstName} ${me.lastName}`,
      body: body.trim().slice(0, 120),
      link: "/messages",
    }).catch(() => {});
  }

  return NextResponse.json({ message });
}
