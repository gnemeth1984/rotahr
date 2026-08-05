import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { UserRole as Role } from "@/types/roles";

function canEdit(role: string, permissions: string[]) {
  return role === Role.ADMIN || role === Role.MANAGER || permissions.includes("menu_planning");
}

// Tenant isolation: courseId came from the URL and dishId from the request
// body, neither checked against the caller's business — so a manager could add,
// edit or delete dishes on another business's function menu. Neither model has
// a businessId column; scope through course -> functionMenu.
async function ownedCourse(courseId: string, menuId: string, businessId: string) {
  return prisma.functionMenuCourse.findFirst({
    where: { id: courseId, functionMenuId: menuId, functionMenu: { businessId } },
    select: { id: true },
  });
}

async function ownedDish(
  dishId: string,
  courseId: string,
  menuId: string,
  businessId: string
) {
  if (!dishId) return null;
  return prisma.functionMenuDish.findFirst({
    where: {
      id: dishId,
      courseId,
      course: { functionMenuId: menuId, functionMenu: { businessId } },
    },
    select: { id: true },
  });
}

// POST — add dish to course
export async function POST(req: NextRequest, { params }: { params: { id: string; courseId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role, session.user.permissions ?? []))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!(await ownedCourse(params.courseId, params.id, session.user.businessId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const dish = await prisma.functionMenuDish.create({
    data: {
      courseId: params.courseId,
      name: body.name,
      description: body.description ?? null,
      notes: body.notes ?? null,
      isVegan: body.isVegan ?? false,
      isVegetarian: body.isVegetarian ?? false,
      isGlutenFree: body.isGlutenFree ?? false,
      isHalal: body.isHalal ?? false,
      isKosher: body.isKosher ?? false,
      allergenGluten: body.allergenGluten ?? false,
      allergenCrustacean: body.allergenCrustacean ?? false,
      allergenEgg: body.allergenEgg ?? false,
      allergenFish: body.allergenFish ?? false,
      allergenPeanut: body.allergenPeanut ?? false,
      allergenSoy: body.allergenSoy ?? false,
      allergenMilk: body.allergenMilk ?? false,
      allergenNuts: body.allergenNuts ?? false,
      allergenCelery: body.allergenCelery ?? false,
      allergenMustard: body.allergenMustard ?? false,
      allergenSesame: body.allergenSesame ?? false,
      allergenSulphites: body.allergenSulphites ?? false,
      allergenLupin: body.allergenLupin ?? false,
      allergenMollusc: body.allergenMollusc ?? false,
      sortOrder: body.sortOrder ?? 0,
    },
  });

  return NextResponse.json({ dish }, { status: 201 });
}

// PATCH — update dish
export async function PATCH(req: NextRequest, { params }: { params: { id: string; courseId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role, session.user.permissions ?? []))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { dishId, ...rest } = await req.json();
  if (!(await ownedDish(dishId, params.courseId, params.id, session.user.businessId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dish = await prisma.functionMenuDish.update({
    where: { id: dishId },
    data: rest,
  });

  return NextResponse.json({ dish });
}

// DELETE — remove dish
export async function DELETE(req: NextRequest, { params }: { params: { id: string; courseId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role, session.user.permissions ?? []))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { dishId } = await req.json();
  if (!(await ownedDish(dishId, params.courseId, params.id, session.user.businessId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.functionMenuDish.delete({ where: { id: dishId } });
  return NextResponse.json({ ok: true });
}
