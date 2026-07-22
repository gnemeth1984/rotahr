import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateCoverImage } from '@/lib/blog/cover-image';

// One-off (re-runnable) backfill: generates a cover image for every published
// post that doesn't have one yet — covers all the posts published while image
// generation was silently broken (wrong model name). Same auth as the daily
// blog cron. Processes a few at a time per call to stay within request limits.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret');
  const authed =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    secret === process.env.CRON_SECRET;
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limitParam = new URL(req.url).searchParams.get('limit');
  const limit = Math.min(parseInt(limitParam || '5', 10) || 5, 10);

  const posts = await prisma.blogPost.findMany({
    where: { coverImage: null, published: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const results = [];
  for (const post of posts) {
    const coverImage = await generateCoverImage(post.title, post.category);
    if (coverImage) {
      await prisma.blogPost.update({ where: { id: post.id }, data: { coverImage } });
    }
    results.push({ slug: post.slug, title: post.title, success: !!coverImage });
  }

  const remaining = await prisma.blogPost.count({ where: { coverImage: null, published: true } });

  return NextResponse.json({ processed: results.length, results, remaining });
}
