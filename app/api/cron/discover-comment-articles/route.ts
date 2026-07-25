import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Daily discovery: searches for recent Reddit/Quora threads mentioning any
// active competitor, relevant to hospitality, and not already in the list.
// Requires SERPER_API_KEY (serper.dev — 2,500 free queries on signup, no
// credit card, then $0.30/1k after — comfortably covers a daily run across
// ~10-15 competitors for a fraction of a cent/month). Scraping Reddit
// directly gets blocked by its bot detection from any datacenter IP
// (confirmed), which is why this goes through a search API instead.
function isConfigured() {
  return Boolean(process.env.SERPER_API_KEY);
}

function slugTitle(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || u.hostname;
    return last.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 150);
  } catch {
    return url.slice(0, 150);
  }
}

async function serperSearch(query: string): Promise<{ title: string; link: string; snippet: string }[]> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, tbs: 'qdr:m2' }), // qdr:m2 = past 2 months
  });
  if (!res.ok) {
    console.error('[discover-comment-articles] Serper API error', res.status, await res.text());
    return [];
  }
  const data = await res.json();
  return (data.organic || []).map((i: any) => ({ title: i.title, link: i.link, snippet: i.snippet || '' }));
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret');
  const authed =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    secret === process.env.CRON_SECRET;
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isConfigured()) {
    return NextResponse.json({
      skipped: true,
      reason: 'Not configured — set SERPER_API_KEY to enable daily auto-discovery.',
    });
  }

  const competitors = await prisma.competitor.findMany({ where: { active: true } });
  if (competitors.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'No active competitors configured.' });
  }

  // Rotate through competitors day-by-day so we stay well within the 100
  // free Google queries/day even as the competitor list grows — process up
  // to 8 per run, picking whichever were checked longest ago (or never).
  const toCheck = competitors
    .sort((a, b) => {
      const aTime = a.lastCheckedAt ? new Date(a.lastCheckedAt).getTime() : 0;
      const bTime = b.lastCheckedAt ? new Date(b.lastCheckedAt).getTime() : 0;
      return aTime - bTime;
    })
    .slice(0, 8);

  const existingUrls = new Set((await prisma.blogCommentArticle.findMany({ select: { url: true } })).map((a) => a.url));

  const added: { title: string; url: string; competitor: string }[] = [];
  const errors: string[] = [];

  for (const comp of toCheck) {
    try {
      const query = `site:reddit.com "${comp.name}" (restaurant OR bar OR cafe OR hotel OR hospitality)`;
      const results = await serperSearch(query);

      for (const r of results) {
        if (!r.link.includes('reddit.com/r/') || !r.link.includes('/comments/')) continue;
        if (existingUrls.has(r.link)) continue;

        await prisma.blogCommentArticle.create({
          data: {
            title: r.title || slugTitle(r.link),
            url: r.link,
            snippet: `${r.snippet} — mentions ${comp.name}. Verify competitor mention and current top comments in-thread before posting.`,
            topic: comp.category || null,
            region: 'general',
            source: 'auto',
            hasComments: true,
            commentPlatform: 'reddit',
            used: false,
          },
        });
        existingUrls.add(r.link);
        added.push({ title: r.title, url: r.link, competitor: comp.name });
      }
    } catch (e: any) {
      errors.push(`${comp.name}: ${e?.message || e}`);
    }
    await prisma.competitor.update({ where: { id: comp.id }, data: { lastCheckedAt: new Date() } }).catch(() => {});
  }

  return NextResponse.json({ checked: toCheck.map((c) => c.name), added: added.length, articles: added, errors });
}
