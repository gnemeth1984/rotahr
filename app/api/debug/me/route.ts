// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const emp = await prisma.employee.findFirst({ where: { userId: session.user.id } });

  return NextResponse.json({
    sessionUserId: session.user.id,
    sessionEmail: session.user.email,
    sessionRole: session.user.role,
    employeeFound: !!emp,
    employeeId: emp?.id ?? null,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : null,
  });
}
