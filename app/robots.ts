import { MetadataRoute } from "next";

// Must stay rotahr.com — pointing crawlers at the Vercel subdomain would split
// ranking signals across two hostnames.
const baseUrl = "https://rotahr.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Signed-in app surfaces and endpoints have no search value, and
        // letting crawlers grind through them wastes crawl budget that should
        // go to the blog and venue pages.
        disallow: [
          "/api/",
          "/dashboard",
          "/admin",
          "/auth/",
          "/redeem/",
          "/crm",
          "/settings",
          "/bookkeeping",
          "/haccp",
          "/stock",
          "/rota",
          "/clock",
          "/messages",
          "/reports",
          "/blog-comments",
          "/linkedin-assistant",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
