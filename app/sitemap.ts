import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { listPublicVenueSlugs } from '@/lib/public-page/data';
import { competitors } from '@/lib/seo/competitors';
import { locations } from '@/lib/seo/locations';
import { features } from '@/lib/seo/features';
import { freeTemplates } from '@/lib/templates';

// Canonical production domain. Must stay rotahr.com — the Vercel subdomain
// would split ranking signals across two hostnames.
const baseUrl = 'https://rotahr.com';

// Rebuild hourly so newly published venue pages and blog posts appear without
// waiting for the next deploy.
export const revalidate = 3600;

/**
 * When the static pages below last materially changed.
 *
 * This used to be `new Date()` on every static entry, which — on a route that
 * regenerates hourly — told Google that all 68 static pages changed minutes
 * ago, every time it looked. A sitemap where everything is always fresh
 * carries no information, so lastmod gets discounted, and it also makes
 * "ping the URLs that actually changed" impossible to implement honestly.
 *
 * One shared constant is deliberately coarse: bumping it marks every static
 * page as touched, which is slightly imprecise but truthful at the day level
 * and far better than claiming continuous change. Blog and venue URLs below
 * keep their real per-row updatedAt.
 *
 * Bump this when you ship a change to a static marketing page.
 */
const STATIC_UPDATED = new Date('2026-09-03T00:00:00Z');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, venues] = await Promise.all([
    prisma.blogPost.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    listPublicVenueSlugs(),
  ]);

  const blogUrls = posts.map(post => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Public venue pages — updated whenever the venue changes a special or dish,
  // so they carry a high change frequency.
  const venueUrls = venues.map(v => ({
    url: `${baseUrl}/v/${v.slug}`,
    lastModified: v.updatedAt,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  return [
    // The bare domain IS the marketing page now. `/landing` used to be the
    // canonical and is a permanent redirect to `/` — listing a redirecting URL
    // makes Google report it as "Page with redirect" instead of indexing it,
    // so only `/` belongs here.
    { url: `${baseUrl}/`, lastModified: STATIC_UPDATED, changeFrequency: 'daily', priority: 1 },
    // Canonical pricing page. The homepage still has a #pricing section, but
    // this is the URL that should rank for "rotahr pricing" style queries.
    { url: `${baseUrl}/pricing`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.6 },
    // Founding member programme. Time-limited offer page, but it is a real
    // landing page with its own FAQ and it is the strongest conversion path
    // we have while there are no customers to point at.
    { url: `${baseUrl}/founding`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: STATIC_UPDATED, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/pitch`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/partners`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.6 },
    // Free venue listing signup. Worth indexing in its own right — "list my
    // restaurant" style queries are how venues find directories.
    { url: `${baseUrl}/list`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    // Directory of every live venue page. The /v/ pages below were reachable
    // only from this sitemap, and sitemap-only URLs get crawled weakly — this
    // is the page that actually links them.
    { url: `${baseUrl}/venues-directory`, lastModified: STATIC_UPDATED, changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/compare`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    // Free template library. Top-of-funnel: "free HACCP temperature log
    // template" style queries have real volume and no commercial intent, and
    // every page links back to the module that replaces the paperwork.
    { url: `${baseUrl}/templates`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    ...freeTemplates.map(t => ({
      url: `${baseUrl}/templates/${t.slug}`,
      lastModified: STATIC_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.75,
    })),
    { url: `${baseUrl}/features`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    // Screenshot tour of the signed-in app. Public on purpose: buyers want to
    // see inside before they sign up, and software-directory reviewers cannot
    // verify a capability that only exists behind a login.
    { url: `${baseUrl}/product-tour`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    // Demo chooser. Used to be a redirect to /auth/signin (and so deliberately
    // absent here); it is a real page now, and it is the only no-signup way to
    // see the product working, so it belongs in the index.
    { url: `${baseUrl}/try`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    // Module pages: match how people actually search ("restaurant HACCP app"),
    // which the landing page's two-line summaries can never rank for.
    ...features.map(f => ({
      url: `${baseUrl}/features/${f.slug}`,
      lastModified: STATIC_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.85,
    })),
    // Comparison + location pages: highest commercial intent on the site, so
    // they carry a priority just under the landing page.
    ...competitors.map(c => ({
      url: `${baseUrl}/compare/${c.slug}`,
      lastModified: STATIC_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
    ...locations.map(l => ({
      url: `${baseUrl}/rota-software/${l.slug}`,
      lastModified: STATIC_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.85,
    })),
    { url: `${baseUrl}/privacy`, lastModified: STATIC_UPDATED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: STATIC_UPDATED, changeFrequency: 'yearly', priority: 0.3 },
    ...venueUrls,
    ...blogUrls,
  ];
}
