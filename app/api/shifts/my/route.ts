// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (isResponse(session)) return session;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Find the employee record linked to this user
  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id },
  });

  if (!employee) {
    return NextResponse.json({ shifts: [] });
  }

  const shifts = await prisma.shift.findMany({
    where: {
      employeeId: employee.id,
      published: true,
      ...(from || to ? {
        date: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to + "T23:59:59Z") } : {}),
        },
      } : {}),
    },
    orderBy: { date: "asc" },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({ shifts, employeeId: employee.id });
}
