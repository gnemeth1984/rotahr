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
    // Answer-engine crawlers, named explicitly. The wildcard rule above already
    // permits them, but being explicit means a future tightening of the
    // wildcard can't silently cut off AI search visibility — and these are the
    // agents that build the shortlists buyers now ask for by name.
    ...[
      "GPTBot", // OpenAI training
      "OAI-SearchBot", // ChatGPT browsing/search
      "ChatGPT-User", // ChatGPT acting on a user request
      "PerplexityBot",
      "Perplexity-User",
      "ClaudeBot",
      "Claude-User",
      "Google-Extended", // Gemini / AI Overviews grounding
      "Applebot-Extended",
      "cohere-ai",
      "meta-externalagent",
    ].map((userAgent) => ({
      userAgent,
      allow: ["/", "/llms.txt"],
      disallow: ["/api/", "/admin", "/auth/", "/settings", "/crm", "/messages"],
    })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
