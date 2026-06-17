// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const { searchParams } = new URL(req.url);
  const withEmployeeId = searchParams.get("with"); // conversation partner

  // Find current employee
  const me = await prisma.employee.findFirst({ where: { userId: session.user.id } });
  if (!me) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const where = withEmployeeId
    ? {
        businessId,
        OR: [
          { senderId: me.id, recipientId: withEmployeeId },
          { senderId: withEmployeeId, recipientId: me.id },
        ],
      }
    : {
        businessId,
        OR: [{ senderId: me.id }, { recipientId: me.id }],
      };

  const messages = await prisma.message.findMany({
    where,
    include: {
      sender: { select: { id: true, firstName: true, lastName: true } },
      recipient: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Mark received messages as read
  await prisma.message.updateMany({
    where: { businessId, recipientId: me.id, read: false,
      ...(withEmployeeId ? { senderId: withEmployeeId } : {}) },
    data: { read: true },
  });

  return NextResponse.json({ messages, meId: me.id });
}
