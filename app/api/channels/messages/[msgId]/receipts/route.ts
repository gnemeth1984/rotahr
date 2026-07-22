// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { getChannelMembers } from "@/lib/services/channel.service";

// Manager/admin only — "who's seen this" for an urgent broadcast: every
// current channel member cross-referenced against who has a receipt.
export async function GET(req: NextRequest, { params }: { params: { msgId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const message = await prisma.channelMessage.findFirst({
    where: { id: params.msgId, channel: { businessId } },
    include: { channel: true, receipts: { select: { employeeId: true, readAt: true } } },
  });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const members = await getChannelMembers(message.channel);
  const readMap = new Map(message.receipts.map((r) => [r.employeeId, r.readAt]));

  const status = members
    .filter((m) => m.id !== message.senderId)
    .map((m) => ({
      employeeId: m.id,
      name: `${m.firstName} ${m.lastName}`,
      read: readMap.has(m.id),
      readAt: readMap.get(m.id) ?? null,
    }));

  return NextResponse.json({
    total: status.length,
    readCount: status.filter((s) => s.read).length,
    status,
  });
}
