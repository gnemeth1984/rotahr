// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { ensureChannels } from "@/lib/services/channel.service";

// GET /api/channels — auto-provisions "Everyone" + per-department channels,
// then returns only the ones the current employee is actually a member of,
// each with an unread count (messages with no receipt from this employee).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  await ensureChannels(businessId);

  const me = await prisma.employee.findFirst({ where: { userId: session.user.id, businessId } });

  const channels = await prisma.messageChannel.findMany({
    where: {
      businessId,
      OR: [{ departmentId: null }, ...(me?.departmentId ? [{ departmentId: me.departmentId }] : [])],
    },
    orderBy: [{ departmentId: "asc" }],
  });

  const withCounts = await Promise.all(
    channels.map(async (c) => {
      const unread = me
        ? await prisma.channelMessage.count({
            where: {
              channelId: c.id,
              senderId: { not: me.id },
              receipts: { none: { employeeId: me.id } },
            },
          })
        : 0;
      return { ...c, unread };
    })
  );

  return NextResponse.json({ channels: withCounts });
}
