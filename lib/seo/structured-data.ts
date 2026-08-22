/**
 * JSON-LD structured data.
 *
 * Google uses this to understand what Rotahr *is* rather than inferring it from
 * prose. It's what makes an entity eligible for a knowledge panel on a brand
 * search, and Article markup is what gets blog posts author/date treatment in
 * results. Cheap to add, and without it a new brand looks like an unclassified
 * page to a crawler.
 */

import { CAPTERRA_URL } from "@/lib/capterra";

export const SITE_URL = "https://rotahr.com";

// Profiles that are demonstrably the same entity as this site. A directory
// listing belongs here: it is the strongest third-party corroboration a young
// brand has. Anything unset is filtered out rather than emitted as null —
// invalid JSON-LD is ignored wholesale, so one bad member costs the lot.
const SAME_AS = [
  "https://ie.linkedin.com/in/gabor-nemeth-02790a42",
  CAPTERRA_URL,
].filter((u): u is string => typeof u === "string" && u.length > 0);

/** Publisher identity — reused so every page points at one consistent entity. */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Rotahr",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/logo-dark.png`,
    },
    description:
      "All-in-one venue management for hospitality — staff rotas, clock-in, reservations, HACCP food safety, bookkeeping and payroll in one app.",
    founder: {
      "@type": "Person",
      name: "Gabor Nemeth",
      jobTitle: "Founder",
    },
    sameAs: SAME_AS,
  };
}

/**
 * The product itself, with pricing. Prices are the VAT-inclusive list prices;
 * keep them in step with the pricing page — contradicting your own visible
 * pricing is worse than omitting the offers entirely.
 */
export function softwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: "Rotahr",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Restaurant Management Software",
    operatingSystem: "Web, iOS, Android",
    /**
     * The capability list in the vocabulary directories and LLMs index on.
     * "Rota" and "bookkeeping" are what customers call these, but nothing
     * matching "inventory" or "accounting" appeared anywhere in our markup,
     * which is a poor showing for a product that does both. POS and order
     * management are deliberately absent rather than softened.
     */
    featureList: [
      "Employee scheduling",
      "Employee management",
      "Time and attendance tracking",
      "Payroll hours export",
      "Inventory management",
      "Recipe and menu costing",
      "Accounting and expense tracking",
      "Reservations and table management",
      "Floor plan management",
      "Customer relationship management",
      "HACCP food safety compliance records",
      "Reporting and analytics",
      "Multi-location management",
    ],
    url: SITE_URL,
    description:
      "Venue management software for pubs, cafés, restaurants and hotels: rota scheduling, clock in/out, table reservations, HACCP compliance, stock, bookkeeping and payroll.",
    publisher: { "@id": `${SITE_URL}/#organization` },
    offers: [
      { name: "Starter", price: "59", description: "Up to 15 staff" },
      { name: "Pro", price: "119", description: "Up to 30 staff" },
      { name: "Enterprise", price: "215", description: "Unlimited staff, multi-venue" },
    ].map((o) => ({
      "@type": "Offer",
      name: o.name,
      price: o.price,
      priceCurrency: "EUR",
      description: o.description,
      url: `${SITE_URL}/#pricing`,
      availability: "https://schema.org/InStock",
    })),
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: "Rotahr",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function articleSchema(opts: {
  title: string;
  description?: string | null;
  slug: string;
  published: Date;
  updated: Date;
}) {
  const url = `${SITE_URL}/blog/${opts.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: opts.title,
    description: opts.description || undefined,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: opts.published.toISOString(),
    dateModified: opts.updated.toISOString(),
    author: { "@type": "Organization", name: "Rotahr", url: SITE_URL },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: `${SITE_URL}${t.path}`,
    })),
  };
}

/**
 * FAQPage schema. Worth adding wherever an article genuinely answers discrete
 * questions: it makes the page eligible for the "People also ask" style
 * treatment and gives AI answer engines something clean to quote.
 */
export function faqSchema(faq: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Renders a JSON-LD block. Server-rendered so crawlers see it in the HTML. */
export function jsonLdProps(schema: object | object[]) {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(schema) },
  } as const;
}
