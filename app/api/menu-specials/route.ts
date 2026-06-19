// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { UserRole as Role } from "@/types/roles";

// GET — list all (non-archived) specials for the business
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("archived") === "1";

  const specials = await prisma.menuSpecial.findMany({
    where: {
      businessId: session.user.businessId,
      archived: includeArchived ? undefined : false,
    },
    include: {
      createdBy: { select: { name: true } },
    },
    orderBy: [{ pinned: "desc" }, { date: "desc" }],
  });

  return NextResponse.json(specials);
}

// POST — create a new special (managers/admins only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (role !== Role.MANAGER && role !== Role.ADMIN)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, description, category, date, endDate, pinned, imageDataUri } = body;

  if (!title || !date)
    return NextResponse.json({ error: "title and date required" }, { status: 400 });

  const special = await prisma.menuSpecial.create({
    data: {
      businessId: session.user.businessId,
      createdById: session.user.id,
      title,
      description: description || null,
      category: category || "special",
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : null,
      pinned: pinned ?? false,
      imageDataUri: imageDataUri || null,
    },
    include: { createdBy: { select: { name: true } } },
  });

  return NextResponse.json(special, { status: 201 });
}
