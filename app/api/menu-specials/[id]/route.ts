// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { UserRole as Role } from "@/types/roles";

// PATCH — update (managers/admins only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (role !== Role.MANAGER && role !== Role.ADMIN)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.menuSpecial.findUnique({ where: { id: params.id } });
  if (!existing || existing.businessId !== session.user.businessId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { title, description, category, date, endDate, pinned, imageDataUri, archived } = body;

  const updated = await prisma.menuSpecial.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(pinned !== undefined && { pinned }),
      ...(imageDataUri !== undefined && { imageDataUri }),
      ...(archived !== undefined && { archived }),
    },
    include: { createdBy: { select: { name: true } } },
  });

  return NextResponse.json(updated);
}

// DELETE — hard delete (managers/admins only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (role !== Role.MANAGER && role !== Role.ADMIN)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.menuSpecial.findUnique({ where: { id: params.id } });
  if (!existing || existing.businessId !== session.user.businessId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.menuSpecial.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
