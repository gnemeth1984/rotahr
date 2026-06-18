// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { createTimeOffSchema } from "@/lib/validators/timeoff";
import { UserRole as Role } from "@/types/roles";
import { sendNewTimeOffRequestEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isManager =
    session.user.role === Role.MANAGER || session.user.role === Role.ADMIN;

  // Find the employee record linked to this user (for non-managers)
  let employeeId: string | undefined;
  if (!isManager) {
    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!employee) {
      return NextResponse.json([]);
    }
    employeeId = employee.id;
  }

  const requests = await prisma.timeOffRequest.findMany({
    where: isManager ? {} : { employeeId },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Normalize: uppercase status, map employee → user shape expected by UI
  const normalized = requests.map((r) => ({
    ...r,
    status: r.status.toUpperCase(),
    user: r.employee
      ? {
          id: r.employee.id,
          name: `${r.employee.firstName} ${r.employee.lastName}`,
          email: r.employee.email,
          image: null,
        }
      : null,
  }));

  return NextResponse.json(normalized);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const result = createTimeOffSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid input", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { startDate, endDate, reason } = result.data;

  // Find the employee record for this user
  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  if (!employee) {
    return NextResponse.json(
      { error: "No employee record found for this account" },
      { status: 400 }
    );
  }

  const request = await prisma.timeOffRequest.create({
    data: {
      employeeId: employee.id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
    },
    include: {
      employee: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  // Notify managers
  try {
    const businessId = (session.user as any).businessId;
    const managers = await prisma.user.findMany({
      where: {
        role: { in: [Role.MANAGER, Role.ADMIN] },
        ...(businessId ? { businessId } : {}),
      },
      select: { email: true, name: true },
    });

    const employeeName = `${employee.firstName} ${employee.lastName}`;

    for (const manager of managers) {
      if (manager.email) {
        await sendNewTimeOffRequestEmail({
          to: manager.email,
          managerName: manager.name ?? "Manager",
          employeeName,
          startDate: request.startDate,
          endDate: request.endDate,
          reason: reason,
        }).catch((e) => console.error("Failed to send notification email:", e));
      }
    }
  } catch (e) {
    console.error("Failed to send notification emails:", e);
  }

  return NextResponse.json(request, { status: 201 });
}
