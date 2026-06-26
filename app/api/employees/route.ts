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
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isManager =
      session.user.role === Role.MANAGER || session.user.role === Role.ADMIN;
    if (!isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const businessId = (session.user as any).businessId as string | undefined;
    if (!businessId) return NextResponse.json({ employees: [] });

    // Query Employee model (has businessId) — not User which has no business filter
    const employees = await prisma.employee.findMany({
      where: { businessId, active: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { firstName: "asc" },
    });

    // Return both the { employees } shape AND flat array for backwards compat
    const mapped = employees.map((e) => ({
      ...e,
      name: `${e.firstName} ${e.lastName}`,
    }));

    return NextResponse.json({ employees: mapped });
  } catch (e) {
    console.error("[GET /api/employees]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
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
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("[PATCH /api/employees]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
