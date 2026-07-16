// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await prisma.emailConnection.findUnique({
    where: { businessId: session.user.businessId },
    include: { connectedBy: { select: { name: true, email: true } } },
  });

  if (!conn) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    provider: conn.provider,
    email: conn.email,
    connectedAt: conn.createdAt,
    connectedBy: conn.connectedBy?.name || conn.connectedBy?.email,
  });
}
