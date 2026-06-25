import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { UserRole as Role } from "@/types/roles";

function canEdit(role: string, permissions: string[]) {
  return role === Role.ADMIN || role === Role.MANAGER || permissions.includes("menu_planning");
}

const include = {
  courses: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      dishes: { orderBy: { sortOrder: "asc" as const } },
    },
  },
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const menus = await prisma.functionMenu.findMany({
    where: { businessId: session.user.businessId },
    include,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ menus });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role, session.user.permissions ?? []))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description, pricePerHead, minGuests, maxGuests } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const menu = await prisma.functionMenu.create({
    data: {
      businessId: session.user.businessId,
      name,
      description,
      pricePerHead: pricePerHead ? parseFloat(pricePerHead) : null,
      minGuests: minGuests ? parseInt(minGuests) : null,
      maxGuests: maxGuests ? parseInt(maxGuests) : null,
    },
    include,
  });

  return NextResponse.json({ menu }, { status: 201 });
}
