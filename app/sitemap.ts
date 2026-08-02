import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { listPublicVenueSlugs } from '@/lib/public-page/data';

// Canonical production domain. Must stay rotahr.com — the Vercel subdomain
// would split ranking signals across two hostnames.
const baseUrl = 'https://rotahr.com';

// Rebuild hourly so newly published venue pages and blog posts appear without
// waiting for the next deploy.
export const revalidate = 3600;

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
    // NOTE: the bare domain is deliberately absent — `/` redirects to
    // `/landing`, and listing a redirecting URL makes Google report it as
    // "Page with redirect" instead of indexing it. `/landing` is the canonical
    // marketing page and is listed below.
    { url: `${baseUrl}/landing`, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/pitch`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/partners`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/compare`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    ...venueUrls,
    ...blogUrls,
  ];
}
