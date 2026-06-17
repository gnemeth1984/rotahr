// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { updateTimeOffSchema } from "@/lib/validators/timeoff";
import { UserRole as Role } from "@/types/roles";
import { sendTimeOffStatusEmail } from "@/lib/email";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isManager =
    session.user.role === Role.MANAGER || session.user.role === Role.ADMIN;
  if (!isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const result = updateTimeOffSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid input", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const request = await prisma.timeOffRequest.findUnique({
    where: { id },
    include: {
      employee: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.timeOffRequest.update({
    where: { id },
    data: {
      status: result.data.status,
      managedById: session.user.id,
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  // Send notification email
  const employeeEmail = updated.employee?.email;
  const employeeName = updated.employee
    ? `${updated.employee.firstName} ${updated.employee.lastName}`
    : "Team Member";

  if (
    employeeEmail &&
    (result.data.status === "APPROVED" || result.data.status === "REJECTED")
  ) {
    try {
      await sendTimeOffStatusEmail({
        to: employeeEmail,
        name: employeeName,
        status: result.data.status,
        startDate: updated.startDate,
        endDate: updated.endDate,
      });
    } catch (e) {
      console.error("Failed to send status email:", e);
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const request = await prisma.timeOffRequest.findUnique({
    where: { id },
    include: { employee: { select: { userId: true } } },
  });

  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isManager =
    session.user.role === Role.MANAGER || session.user.role === Role.ADMIN;
  const isOwner = request.employee?.userId === session.user.id;

  if (!isManager && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.timeOffRequest.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
