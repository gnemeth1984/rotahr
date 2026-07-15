// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// GET /api/venues/[id]/checklists
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const checklists = await prisma.venueChecklist.findMany({
    where: { venueId: params.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ checklists });
}

// POST /api/venues/[id]/checklists — create checklist
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, category, items } = await req.json();
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const itemList: string[] = Array.isArray(items) ? items.filter((i: string) => i && i.trim()) : [];

  const checklist = await prisma.venueChecklist.create({
    data: {
      venueId: params.id,
      businessId: (await prisma.venue.findUnique({ where: { id: params.id }, select: { businessId: true } }))?.businessId ?? "",
      title,
      category: category ?? "general",
      items: {
        create: itemList.map((label, i) => ({ label, sortOrder: i })),
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json({ checklist }, { status: 201 });
}
