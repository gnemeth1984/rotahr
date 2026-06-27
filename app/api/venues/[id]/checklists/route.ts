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
    include: { items: { orderBy: { order: "asc" } } },
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

  const { title, type } = await req.json();
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const checklist = await prisma.venueChecklist.create({
    data: { venueId: params.id, title, type: type ?? "OPENING" },
    include: { items: true },
  });
  return NextResponse.json({ checklist }, { status: 201 });
}
