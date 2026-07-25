// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";
import { z } from "zod";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const competitors = await prisma.competitor.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ competitors });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const competitor = await prisma.competitor.upsert({
    where: { name: parsed.data.name },
    create: { name: parsed.data.name, category: parsed.data.category || null },
    update: { active: true, category: parsed.data.category || undefined },
  });

  return NextResponse.json({ competitor }, { status: 201 });
}

const patchSchema = z.object({ id: z.string(), active: z.boolean().optional(), category: z.string().optional().nullable() });

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id, ...data } = parsed.data;
  const competitor = await prisma.competitor.update({ where: { id }, data });
  return NextResponse.json({ competitor });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.competitor.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
