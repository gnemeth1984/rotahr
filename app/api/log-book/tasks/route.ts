// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const { searchParams } = new URL(req.url);
  const completedParam = searchParams.get("completed");

  const tasks = await prisma.opsTask.findMany({
    where: {
      businessId,
      ...(completedParam !== null ? { completed: completedParam === "true" } : {}),
    },
    include: {
      assignedTo: { select: { firstName: true, lastName: true } },
      assignedDepartment: { select: { id: true, name: true } },
      venue: { select: { name: true } },
      createdBy: { select: { name: true } },
      _count: { select: { updates: true } },
    },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return NextResponse.json({ tasks });
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  frequency: z.enum(["once", "daily", "weekly"]).default("once"),
  dueDate: z.string().optional().nullable(),
  requirePhoto: z.boolean().default(false),
  assignedToId: z.string().optional().nullable(),
  assignedRole: z.string().optional().nullable(),
  assignedDepartmentId: z.string().optional().nullable(),
  sourceMessageId: z.string().optional().nullable(),
  venueId: z.string().optional().nullable(),
});

// Creating/assigning tasks stays manager/admin — matches the UI (isManager gate)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const task = await prisma.opsTask.create({
    data: {
      businessId,
      venueId: parsed.data.venueId || null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      frequency: parsed.data.frequency,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      requirePhoto: parsed.data.requirePhoto,
      assignedToId: parsed.data.assignedToId || null,
      assignedRole: parsed.data.assignedRole || null,
      assignedDepartmentId: parsed.data.assignedDepartmentId || null,
      sourceMessageId: parsed.data.sourceMessageId || null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
