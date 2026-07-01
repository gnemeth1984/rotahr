import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSessionBusiness(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, businessId: true, role: true },
  });
  return user;
}

// GET /api/haccp/equipment?type=fridge   → list all or by type
export async function GET(req: NextRequest) {
  const user = await getSessionBusiness(req);
  if (!user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = new URL(req.url).searchParams.get("type");

  const equipment = await prisma.hACCPEquipment.findMany({
    where: {
      businessId: user.businessId,
      ...(type ? { equipType: type } : {}),
    },
    orderBy: [{ equipType: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ equipment });
}

// POST /api/haccp/equipment   → create
export async function POST(req: NextRequest) {
  const user = await getSessionBusiness(req);
  if (!user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "MANAGER" && user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, equipType } = await req.json();
  if (!name?.trim() || !equipType) return NextResponse.json({ error: "name and equipType required" }, { status: 400 });

  const equipment = await prisma.hACCPEquipment.create({
    data: {
      businessId: user.businessId,
      name: name.trim(),
      equipType,
    },
  });

  return NextResponse.json({ equipment });
}

// DELETE /api/haccp/equipment?id=xxx
export async function DELETE(req: NextRequest) {
  const user = await getSessionBusiness(req);
  if (!user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "MANAGER" && user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Verify ownership
  const eq = await prisma.hACCPEquipment.findFirst({ where: { id, businessId: user.businessId } });
  if (!eq) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.hACCPEquipment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
