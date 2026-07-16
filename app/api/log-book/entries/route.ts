// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { notifyUsers } from "@/lib/services/appNotification.service";

// Any authenticated staff member can view/log entries (matches Messages/Shift
// Swaps — this is a "core, all roles" feature, not manager/admin-gated).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "note" | "86" | "repair" | null (all)
  const resolvedParam = searchParams.get("resolved"); // "true" | "false" | null

  const entries = await prisma.logEntry.findMany({
    where: {
      businessId,
      ...(type ? { type } : {}),
      ...(resolvedParam !== null ? { resolved: resolvedParam === "true" } : {}),
    },
    include: {
      createdBy: { select: { name: true, email: true } },
      venue: { select: { name: true } },
      updates: {
        include: { createdBy: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ entries });
}

const createSchema = z.object({
  type: z.enum(["note", "86", "repair"]),
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  venueId: z.string().optional().nullable(),
  assignedToName: z.string().max(120).optional().nullable(),
  dueAt: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const entry = await prisma.logEntry.create({
    data: {
      businessId,
      venueId: parsed.data.venueId || null,
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description || null,
      assignedToName: parsed.data.assignedToName || null,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      createdById: session.user.id,
    },
  });

  // Notify managers/admins immediately for anything that needs action —
  // an 86'd item or a repair issue. Plain shift notes don't need to interrupt
  // anyone. Reporter themselves is excluded if they're already a manager.
  if (parsed.data.type === "86" || parsed.data.type === "repair") {
    const managers = await prisma.user.findMany({
      where: {
        businessId,
        role: { in: ["MANAGER", "ADMIN"] },
        id: { not: session.user.id },
      },
      select: { id: true },
    });

    if (managers.length > 0) {
      const reporterName = session.user.name || session.user.email || "A team member";
      const typeLabel = parsed.data.type === "86" ? "86'd an item" : "reported a repair issue";
      await notifyUsers(
        managers.map((m) => m.id),
        {
          type: "logbook",
          title: `${reporterName} ${typeLabel}`,
          body: parsed.data.title,
          link: "/log-book",
        }
      ).catch(() => {});
    }
  }

  return NextResponse.json({ entry }, { status: 201 });
}
