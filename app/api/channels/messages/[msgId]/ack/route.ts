// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// Explicit "I've read this" acknowledgement — required for urgent messages
// instead of the passive auto-mark-read-on-open behaviour normal messages get.
export async function POST(req: NextRequest, { params }: { params: { msgId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const message = await prisma.channelMessage.findFirst({
    where: { id: params.msgId, channel: { businessId } },
  });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const me = await prisma.employee.findFirst({ where: { userId: session.user.id, businessId } });
  if (!me) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  await prisma.channelMessageReceipt.upsert({
    where: { channelMessageId_employeeId: { channelMessageId: params.msgId, employeeId: me.id } },
    create: { channelMessageId: params.msgId, employeeId: me.id },
    update: {},
  });

  return NextResponse.json({ success: true });
}
