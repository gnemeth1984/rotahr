import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { UserRole as Role } from "@/types/roles";

function canEdit(role: string, permissions: string[]) {
  return (
    role === Role.ADMIN ||
    role === Role.MANAGER ||
    permissions.includes("menu_planning")
  );
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dishes = await prisma.dish.findMany({
    where: { businessId: session.user.businessId },
    include: {
      ingredients: {
        include: { stockItem: { select: { id: true, name: true, unit: true, lastPrice: true } } },
      },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ dishes });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role, session.user.permissions ?? []))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, category, sellPrice, costPrice, imageUrl } = body;
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const dish = await prisma.dish.create({
    data: {
      businessId: session.user.businessId,
      name,
      description,
      category: category ?? "main",
      sellPrice: sellPrice ? parseFloat(sellPrice) : null,
      costPrice: costPrice ? parseFloat(costPrice) : null,
      imageUrl,
    },
  });

  return NextResponse.json({ dish }, { status: 201 });
}
