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
    include: { dishes: { orderBy: { sortOrder: "asc" as const } } },
  },
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const menu = await prisma.functionMenu.findFirst({
    where: { id: params.id, businessId: session.user.businessId },
    include,
  });
  if (!menu) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ menu });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role, session.user.permissions ?? []))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, pricePerHead, minGuests, maxGuests, isActive } = body;

  const menu = await prisma.functionMenu.update({
    where: { id: params.id, businessId: session.user.businessId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(pricePerHead !== undefined && { pricePerHead: pricePerHead ? parseFloat(pricePerHead) : null }),
      ...(minGuests !== undefined && { minGuests: minGuests ? parseInt(minGuests) : null }),
      ...(maxGuests !== undefined && { maxGuests: maxGuests ? parseInt(maxGuests) : null }),
      ...(isActive !== undefined && { isActive }),
    },
    include,
  });

  return NextResponse.json({ menu });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role, session.user.permissions ?? []))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.functionMenu.delete({ where: { id: params.id, businessId: session.user.businessId } });
  return NextResponse.json({ ok: true });
}
