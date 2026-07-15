// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";
import { generateBlogComment } from "@/lib/ai/blog-comments";
import { z } from "zod";

const schema = z.object({
  articleId: z.string().optional().nullable(),
  articleTitle: z.string(),
  articleUrl: z.string(),
  articleSnippet: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { articleId, articleTitle, articleUrl, articleSnippet, note } = parsed.data;

  const draft = await generateBlogComment({ articleTitle, articleUrl, articleSnippet, note });

  const saved = await prisma.blogCommentDraft.create({
    data: {
      articleId: articleId || null,
      articleTitle,
      articleUrl,
      note: note || null,
      draftComment: draft,
    },
  });

  return NextResponse.json({ id: saved.id, draft });
}
