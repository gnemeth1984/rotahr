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
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.blogCommentArticle.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ articles: rows });
}

const bulkSchema = z.object({
  articles: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string().optional().nullable(),
      topic: z.string().optional().nullable(),
      region: z.string().optional().nullable(),
      hasComments: z.boolean().optional().nullable(),
      commentPlatform: z.string().optional().nullable(),
      source: z.string().optional(),
    })
  ),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const created = await prisma.$transaction(
    parsed.data.articles.map((a) =>
      prisma.blogCommentArticle.create({
        data: {
          title: a.title,
          url: a.url,
          snippet: a.snippet || null,
          topic: a.topic || null,
          region: a.region || null,
          source: a.source || "user",
          hasComments: a.hasComments ?? null,
          commentPlatform: a.commentPlatform || null,
        },
      })
    )
  );

  return NextResponse.json({ created: created.length });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.blogCommentArticle.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

const patchSchema = z.object({
  used: z.boolean().optional(),
  title: z.string().optional(),
  snippet: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  await prisma.blogCommentArticle.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true });
}
