import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { UserRole as Role } from "@/types/roles";

function canEdit(role: string, permissions: string[]) {
  return role === Role.ADMIN || role === Role.MANAGER || permissions.includes("menu_planning");
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role, session.user.permissions ?? []))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, category, sellPrice, costPrice, imageUrl, active, ingredients } = body;

  const dish = await prisma.dish.update({
    where: { id: params.id, businessId: session.user.businessId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category }),
      ...(sellPrice !== undefined && { sellPrice: sellPrice ? parseFloat(sellPrice) : null }),
      ...(costPrice !== undefined && { costPrice: costPrice ? parseFloat(costPrice) : null }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(active !== undefined && { active }),
    },
  });

  // Replace ingredients if provided
  if (ingredients !== undefined) {
    await prisma.dishIngredient.deleteMany({ where: { dishId: params.id } });
    if (ingredients.length > 0) {
      await prisma.dishIngredient.createMany({
        data: ingredients.map((ing: { name: string; stockItemId?: string; qty: number; unit: string }) => ({
          dishId: params.id,
          name: ing.name,
          stockItemId: ing.stockItemId ?? null,
          qty: ing.qty ?? 1,
          unit: ing.unit ?? "unit",
        })),
      });
    }
  }

  const updated = await prisma.dish.findUnique({
    where: { id: params.id },
    include: { ingredients: { include: { stockItem: { select: { id: true, name: true, unit: true, lastPrice: true } } } } },
  });

  return NextResponse.json({ dish: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role, session.user.permissions ?? []))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.dish.delete({ where: { id: params.id, businessId: session.user.businessId } });
  return NextResponse.json({ ok: true });
}
