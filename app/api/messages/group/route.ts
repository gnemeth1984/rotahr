// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { UserRole as Role } from "@/types/roles";
import { notifyUsers } from "@/lib/services/appNotification.service";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isManager =
    session.user.role === Role.MANAGER || session.user.role === Role.ADMIN;
  if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const { recipientIds, body } = await req.json();

  if (!Array.isArray(recipientIds) || recipientIds.length === 0 || !body?.trim()) {
    return NextResponse.json({ error: "recipientIds[] and body required" }, { status: 400 });
  }

  const me = await prisma.employee.findFirst({ where: { userId: session.user.id } });
  if (!me) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  // Send one message per recipient
  const messages = await prisma.$transaction(
    recipientIds.map((recipientId: string) =>
      prisma.message.create({
        data: { businessId, senderId: me.id, recipientId, body: body.trim() },
      })
    )
  );

  // Notify each recipient who has a user account
  const recipients = await prisma.employee.findMany({
    where: { id: { in: recipientIds } },
    select: { userId: true },
  });
  const userIds = recipients.map((r) => r.userId).filter(Boolean) as string[];
  if (userIds.length > 0) {
    await notifyUsers(userIds, {
      type: "message",
      title: `New message from ${me.firstName} ${me.lastName}`,
      body: body.trim().slice(0, 120),
      link: `/messages?thread=${me.id}`,
    });
  }

  return NextResponse.json({ sent: messages.length });
}
