/**
 * JSON-LD structured data.
 *
 * Google uses this to understand what Rotahr *is* rather than inferring it from
 * prose. It's what makes an entity eligible for a knowledge panel on a brand
 * search, and Article markup is what gets blog posts author/date treatment in
 * results. Cheap to add, and without it a new brand looks like an unclassified
 * page to a crawler.
 */

export const SITE_URL = "https://rotahr.com";

const SAME_AS = [
  "https://ie.linkedin.com/in/gabor-nemeth-02790a42",
];

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
    applicationSubCategory: "Workforce Management",
    operatingSystem: "Web, iOS, Android",
    url: SITE_URL,
    description:
      "Venue management software for pubs, cafés, restaurants and hotels: rota scheduling, clock in/out, table reservations, HACCP compliance, stock, bookkeeping and payroll.",
    publisher: { "@id": `${SITE_URL}/#organization` },
    offers: [
      { name: "Starter", price: "59", description: "Up to 10 staff" },
      { name: "Pro", price: "119", description: "Up to 30 staff" },
      { name: "Enterprise", price: "215", description: "Unlimited staff, multi-venue" },
    ].map((o) => ({
      "@type": "Offer",
      name: o.name,
      price: o.price,
      priceCurrency: "EUR",
      description: o.description,
      url: `${SITE_URL}/landing#pricing`,
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
