// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { getChannelMembers } from "@/lib/services/channel.service";
import { notifyUsers } from "@/lib/services/appNotification.service";
import { z } from "zod";

// GET — list messages, and (side effect) auto-mark every non-urgent message
// as read for the current employee, same as opening any chat app. Urgent
// messages are NOT auto-marked — they need an explicit acknowledgement.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const channel = await prisma.messageChannel.findFirst({ where: { id: params.id, businessId } });
  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const me = await prisma.employee.findFirst({ where: { userId: session.user.id, businessId } });

  const messages = await prisma.channelMessage.findMany({
    where: { channelId: params.id },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true } },
      receipts: me ? { where: { employeeId: me.id }, select: { employeeId: true, readAt: true } } : false,
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  if (me) {
    const toAutoRead = messages.filter((m) => !m.urgent && m.senderId !== me.id && m.receipts.length === 0);
    if (toAutoRead.length > 0) {
      await prisma.channelMessageReceipt.createMany({
        data: toAutoRead.map((m) => ({ channelMessageId: m.id, employeeId: me.id })),
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      channelId: m.channelId,
      sender: m.sender,
      body: m.body,
      urgent: m.urgent,
      createdAt: m.createdAt,
      readByMe: m.receipts?.length > 0,
    })),
  });
}

const schema = z.object({ body: z.string().min(1).max(2000), urgent: z.boolean().default(false) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const channel = await prisma.messageChannel.findFirst({ where: { id: params.id, businessId } });
  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const me = await prisma.employee.findFirst({ where: { userId: session.user.id, businessId } });
  if (!me) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const message = await prisma.channelMessage.create({
    data: { channelId: params.id, senderId: me.id, body: parsed.data.body, urgent: parsed.data.urgent },
    include: { sender: { select: { firstName: true, lastName: true } } },
  });

  const members = await getChannelMembers(channel);
  const userIds = members.filter((m) => m.id !== me.id && m.userId).map((m) => m.userId as string);
  if (userIds.length > 0) {
    await notifyUsers(userIds, {
      type: "message",
      title: parsed.data.urgent
        ? `⚠️ Urgent — ${channel.name}: ${message.sender.firstName} ${message.sender.lastName}`
        : `${channel.name}: ${message.sender.firstName} ${message.sender.lastName}`,
      body: parsed.data.body.slice(0, 120),
      link: `/messages?channel=${params.id}`,
    }).catch(() => {});
  }

  return NextResponse.json({ message }, { status: 201 });
}
