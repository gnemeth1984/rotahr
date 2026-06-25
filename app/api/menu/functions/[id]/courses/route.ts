import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { UserRole as Role } from "@/types/roles";

function canEdit(role: string, permissions: string[]) {
  return role === Role.ADMIN || role === Role.MANAGER || permissions.includes("menu_planning");
}

// POST — add a course to a menu
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role, session.user.permissions ?? []))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify menu belongs to business
  const menu = await prisma.functionMenu.findFirst({
    where: { id: params.id, businessId: session.user.businessId },
  });
  if (!menu) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { courseType, label, choiceCount, sortOrder } = await req.json();
  if (!courseType) return NextResponse.json({ error: "courseType required" }, { status: 400 });

  const course = await prisma.functionMenuCourse.create({
    data: {
      functionMenuId: params.id,
      courseType,
      label: label ?? null,
      choiceCount: choiceCount ?? 1,
      sortOrder: sortOrder ?? 0,
    },
    include: { dishes: true },
  });

  return NextResponse.json({ course }, { status: 201 });
}

// PATCH — reorder / update courses (bulk)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role, session.user.permissions ?? []))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { courseId, label, choiceCount, sortOrder } = await req.json();

  const course = await prisma.functionMenuCourse.update({
    where: { id: courseId },
    data: {
      ...(label !== undefined && { label }),
      ...(choiceCount !== undefined && { choiceCount: parseInt(choiceCount) }),
      ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
    },
    include: { dishes: true },
  });

  return NextResponse.json({ course });
}

// DELETE — remove a course
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role, session.user.permissions ?? []))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { courseId } = await req.json();
  await prisma.functionMenuCourse.delete({ where: { id: courseId } });
  return NextResponse.json({ ok: true });
}
