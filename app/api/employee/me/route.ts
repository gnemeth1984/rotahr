// @ts-nocheck
import { NextResponse } from "next/server";
import { requireAuth, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await requireAuth();
  if (isResponse(session)) return session;

  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id },
    select: { id: true, firstName: true, lastName: true, email: true, departmentId: true, hourlyRate: true },
  });

  if (!employee) return NextResponse.json({ employee: null });
  return NextResponse.json({ employee });
}
