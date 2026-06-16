// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { UserRole as Role } from "@/types/roles";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isManager =
    session.user.role === Role.MANAGER || session.user.role === Role.ADMIN;
  if (!isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employees = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      department: true,
      phone: true,
      createdAt: true,
      _count: {
        select: { bookings: true, requests: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(employees);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === Role.ADMIN;
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, ...data } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const result = updateUserSchema.safeParse(data);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid input", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: result.data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      phone: true,
    },
  });

  return NextResponse.json(updated);
}
