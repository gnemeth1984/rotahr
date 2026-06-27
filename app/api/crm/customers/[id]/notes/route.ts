import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const noteSchema = z.object({ note: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verify customer belongs to business
  const customer = await prisma.customer.findFirst({
    where: { id, businessId: session.user.businessId },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const note = await prisma.crmNote.create({
    data: {
      customerId: id,
      authorId: session.user.id,
      note: parsed.data.note,
    },
    include: { author: { select: { name: true, email: true } } },
  });

  return NextResponse.json(note, { status: 201 });
}
