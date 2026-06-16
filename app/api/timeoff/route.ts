import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { createTimeOffSchema } from "@/lib/validators/timeoff";
import { Role } from "@prisma/client";
import { sendNewTimeOffRequestEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isManager =
    session.user.role === Role.MANAGER || session.user.role === Role.ADMIN;

  const requests = await prisma.timeOffRequest.findMany({
    where: isManager ? {} : { userId: session.user.id },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
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

  const request = await prisma.timeOffRequest.create({
    data: {
      userId: session.user.id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
    },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  // Notify managers
  try {
    const managers = await prisma.user.findMany({
      where: { role: { in: [Role.MANAGER, Role.ADMIN] } },
      select: { email: true, name: true },
    });

    for (const manager of managers) {
      if (manager.email) {
        await sendNewTimeOffRequestEmail({
          to: manager.email,
          managerName: manager.name ?? "Manager",
          employeeName: request.user.name ?? "An employee",
          startDate: request.startDate,
          endDate: request.endDate,
          reason: reason,
        });
      }
    }
  } catch (e) {
    // Email failure shouldn't block the request
    console.error("Failed to send notification email:", e);
  }

  return NextResponse.json(request, { status: 201 });
}
