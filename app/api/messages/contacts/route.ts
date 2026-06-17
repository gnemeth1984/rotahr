// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// Returns all active employees in the same business (for messaging contacts)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  // Find current employee to exclude self
  const me = await prisma.employee.findFirst({ where: { userId: session.user.id } });

  const employees = await prisma.employee.findMany({
    where: {
      businessId,
      active: true,
      ...(me ? { id: { not: me.id } } : {}),
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return NextResponse.json({ employees });
}
