import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messages = await prisma.guestMessage.findMany({
    where: { customerId: id, businessId: session.user.businessId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ messages });
}
