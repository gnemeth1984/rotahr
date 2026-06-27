import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = session.user.businessId;

  // Wipe all POS data — GDPR right to erasure
  await prisma.$transaction([
    prisma.posSnapshot.deleteMany({ where: { businessId: businessId! } }),
    prisma.posConnection.deleteMany({ where: { businessId: businessId! } }),
  ]);

  return NextResponse.json({ disconnected: true });
}
