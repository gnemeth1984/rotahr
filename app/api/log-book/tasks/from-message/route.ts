// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  messageId: z.string().min(1),
  // channel messages and 1:1 messages are different models — tell us which
  source: z.enum(["message", "channelMessage"]).default("message"),
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  assignedRole: z.string().optional().nullable(),
  assignedDepartmentId: z.string().optional().nullable(),
});

// Converts a message (1:1 or channel) directly into an Ops Task in one tap —
// no retyping what was already said. Keeps the exact original message body
// as the task description context and links back via sourceMessageId.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const d = parsed.data;

  let originalBody = "";
  if (d.source === "message") {
    const msg = await prisma.message.findFirst({ where: { id: d.messageId, businessId } });
    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    originalBody = msg.body;
  } else {
    const msg = await prisma.channelMessage.findFirst({
      where: { id: d.messageId, channel: { businessId } },
    });
    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    originalBody = msg.body;
  }

  const task = await prisma.opsTask.create({
    data: {
      businessId,
      title: d.title,
      description: d.description || `From message: "${originalBody}"`,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      assignedToId: d.assignedToId || null,
      assignedRole: d.assignedRole || null,
      assignedDepartmentId: d.assignedDepartmentId || null,
      sourceMessageId: d.messageId,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
