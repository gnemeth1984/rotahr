import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { createBookingSchema } from "@/lib/validators/booking";
import { UserRole as Role } from "@/types/roles";


export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  // Managers/admins can view all bookings; employees see only their own
  const isManager =
    session.user.role === Role.MANAGER || session.user.role === Role.ADMIN;

  const bookings = await prisma.booking.findMany({
    where: {
      userId:
        isManager && userId
          ? userId
          : isManager
          ? undefined
          : session.user.id,
    },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const result = createBookingSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid input", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { date, startTime, endTime, title, notes, userId } = result.data;

  // Only managers can create bookings for other users
  const isManager =
    session.user.role === Role.MANAGER || session.user.role === Role.ADMIN;
  const targetUserId =
    isManager && userId ? userId : session.user.id;

  const booking = await prisma.booking.create({
    data: {
      userId: targetUserId,
      date: new Date(date),
      startTime,
      endTime,
      title: title ?? "Shift",
      notes,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(booking, { status: 201 });
}
