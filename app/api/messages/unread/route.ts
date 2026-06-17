// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ unread: [], count: 0 });

  const me = await prisma.employee.findFirst({ where: { userId: session.user.id } });
  if (!me) return NextResponse.json({ unread: [], count: 0 });

  // Group unread by sender so the messages page can show per-contact badges
  const grouped = await prisma.message.groupBy({
    by: ["senderId"],
    where: { recipientId: me.id, read: false },
    _count: { _all: true },
  });

  const total = grouped.reduce((sum, g) => sum + (g._count?._all ?? 0), 0);

  return NextResponse.json({ unread: grouped, count: total });
}
