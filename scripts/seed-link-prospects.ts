/**
 * Seed the off-site visibility pipeline.
 *
 * Every row below was checked by hand in August 2026: the site exists, the
 * contact address was read off the target's own contact/about page, and the
 * angle is specific to that outlet. Nothing is guessed.
 *
 * Where a target publishes no address, contactEmail is null and contactNote
 * says how they actually accept submissions. A fabricated editor address costs
 * a spam complaint on a domain with no reputation to spare — a null costs one
 * manual form fill.
 *
 * Idempotent: upserts on url, and never overwrites status/liveUrl/sentAt, so
 * re-running cannot undo progress you've already made.
 *
 *   npx tsx --env-file=.env.local scripts/seed-link-prospects.ts
 */

import { prisma } from "@/lib/prisma";

type Row = {
  name: string;
  url: string;
  kind: "directory" | "press" | "guest_post" | "podcast" | "community" | "partner";
  region: "ie" | "uk" | "general";
  weight: number;
  contactEmail?: string;
  contactName?: string;
  contactNote?: string;
  angle: string;
};

const ROWS: Row[] = [
  // ── Directories ─────────────────────────────────────────────────────────
  // Free, we control the copy, and they resolve fast. Each one is also a
  // `sameAs` candidate: a crawler treats a vetted directory profile as
  // third-party corroboration that the brand is a real entity.
  {
    name: "Capterra",
    url: "https://www.capterra.com/",
    kind: "directory",
    region: "general",
    weight: 9,
    contactNote:
      "Listing already LIVE as of 11 Aug 2026. Outstanding: get the canonical /p/<id>/Rotahr/ URL out of the Capterra confirmation email and set CAPTERRA_URL in lib/capterra.ts — footer link and Organization sameAs are already wired and inert until then.",
    angle:
      "Already published. Highest-intent directory in the category: buyers arrive having already decided to buy something.",
  },
  {
    name: "GetApp",
    url: "https://www.getapp.com/",
    kind: "directory",
    region: "general",
    weight: 8,
    contactNote:
      "Same parent as Capterra (Gartner Digital Markets) — the vendor portal that published the Capterra listing usually syndicates to GetApp and Software Advice from one submission. Check the existing vendor login before filling anything in again.",
    angle: "Free syndication of a listing that already exists. Effort is near zero if the Gartner portal covers it.",
  },
  {
    name: "Software Advice",
    url: "https://www.softwareadvice.com/",
    kind: "directory",
    region: "general",
    weight: 7,
    contactNote: "Third Gartner Digital Markets property — same vendor portal as Capterra/GetApp.",
    angle: "Completes the Gartner set from a single vendor login.",
  },
  {
    name: "G2",
    url: "https://www.g2.com/",
    kind: "directory",
    region: "general",
    weight: 9,
    contactNote:
      "Free product profile at g2.com/products/new. Gating factor is reviews, not the listing — G2 ranks on review count and Rotahr currently has one real trial user, so this stays low-yield until there are paying venues to ask.",
    angle: "Largest B2B software review site. Worth claiming the profile early so the URL is ours when reviews do exist.",
  },
  {
    name: "AlternativeTo",
    url: "https://alternativeto.net/",
    kind: "directory",
    region: "general",
    weight: 6,
    contactNote: "Community submission, no account approval queue. Listing as an alternative to the incumbents is the point.",
    angle:
      "Captures 'alternative to 7shifts / Deputy / RotaCloud' intent, which is exactly the comparison pages we already publish at /compare.",
  },
  {
    name: "SaaSHub",
    url: "https://www.saashub.com/",
    kind: "directory",
    region: "general",
    weight: 5,
    contactNote: "Free submission form. Fast approval, dofollow listing.",
    angle: "Cheap, quick, and reinforces the same 'alternative to' intent as AlternativeTo.",
  },
  {
    name: "Crunchbase",
    url: "https://www.crunchbase.com/",
    kind: "directory",
    region: "general",
    weight: 7,
    contactNote:
      "Free company profile. Note Gabor is self-employed, not an Ltd — fill the profile as a solo-founded company and do not imply funding or incorporation that doesn't exist.",
    angle:
      "Standard entity signal. Crunchbase is one of the sources knowledge panels and AI assistants pull company facts from, which feeds the AI-visibility work already running.",
  },
  {
    name: "Product Hunt",
    url: "https://www.producthunt.com/",
    kind: "directory",
    region: "general",
    weight: 7,
    contactNote:
      "One shot — a launch can't be repeated, so it should wait until there are paying customers and a demo video worth showing. Maker profile should be warmed up for a few weeks first; a cold account launching to nobody is the usual failure mode.",
    angle:
      "Traffic spike plus a durable dofollow link. Best held back until the product has social proof to convert the spike.",
  },
  {
    name: "SourceForge (Business Software)",
    url: "https://sourceforge.net/software/",
    kind: "directory",
    region: "general",
    weight: 5,
    contactNote: "Free vendor listing in the business-software section.",
    angle: "High-authority domain, low effort, minimal downside.",
  },

  // ── Irish trade press ───────────────────────────────────────────────────
  // The strongest opportunity in the list. A named Irish founder building
  // hospitality software after working as a chef is a story these outlets
  // actually run, and the audience IS the customer.
  {
    name: "Hospitality Ireland",
    url: "https://www.hospitalityireland.com/",
    kind: "press",
    region: "ie",
    weight: 9,
    contactEmail: "robert.mchugh@hospitality-ireland.com",
    contactName: "Robert McHugh, Online Editor",
    contactNote:
      "Address read off hospitalityireland.com/about. Editorial only — sales@hospitalityireland.com is the advertising route and should not be used for a story pitch. They have a dedicated Equipment/Technology section.",
    angle:
      "Ireland's leading foodservice trade title, with a standing Technology section. Story: a Hungarian chef who worked Irish kitchens built the scheduling and HACCP system he needed, and is now selling it to Irish venues. Concrete hooks: HACCP goes paperless, and Irish break-entitlement law (4.5h/6h) enforced automatically.",
  },
  {
    name: "Hotel & Restaurant Times",
    url: "https://www.hotelandrestauranttimes.ie/",
    kind: "press",
    region: "ie",
    weight: 7,
    contactNote:
      "Publishes no email on its contact page — use the on-site contact form. Established 1998; has content agreements with the RAI, IFSA and IASI, so a mention here can echo into association newsletters.",
    angle:
      "Ireland's longest-running hospitality magazine, and it feeds RAI/IFSA/IASI member content. One placement reaches several member bases.",
  },
  {
    name: "Restaurants Association of Ireland — trade partner",
    url: "https://www.rai.ie/how-to-partner/",
    kind: "partner",
    region: "ie",
    weight: 9,
    contactEmail: "info@rai.ie",
    contactName: "RAI partnerships (laura@rai.ie also listed)",
    contactNote:
      "Both addresses are published on rai.ie/how-to-partner. Tel +353 1 677 9901. ~150 trade members listed as approved suppliers. Paid membership — confirm the fee before committing, but the approved-suppliers page is a genuine dofollow listing in front of the exact buyer.",
    angle:
      "The single best-targeted placement available: their membership is Irish restaurant owners, which is precisely who Rotahr sells to. Distribution and a link in one move. Back of House already runs an RAI-exclusive offer, so member-only deals are an established format here.",
  },

  // ── UK trade press ──────────────────────────────────────────────────────
  {
    name: "Restaurant Industry News",
    url: "https://restaurantindustry.co.uk/",
    kind: "press",
    region: "uk",
    weight: 7,
    contactEmail: "editor@restaurantindustry.co.uk",
    contactNote:
      "editorial@restaurantindustry.co.uk also published on their contact page. Bi-monthly UK digital trade publication that actively covers restaurant technology.",
    angle:
      "Lines up with the UK expansion — 347 verified UK venues are already in the outreach list, and multi-currency plus UK VAT labelling already ship.",
  },
  {
    name: "Restaurant Technology News",
    url: "https://restauranttechnologynews.com/",
    kind: "guest_post",
    region: "general",
    weight: 7,
    contactEmail: "RTN@hoteltechnologynews.com",
    contactNote:
      "Their contact page explicitly invites bylined articles and press releases. Read as: they want useful writing, not a product pitch.",
    angle:
      "Bylined piece with a real operator's angle — e.g. what actually breaks when a venue runs HACCP on paper, from someone who did it in a kitchen. Product mention earns its place in the author bio, not the body.",
  },
  {
    name: "The Caterer",
    url: "https://www.thecaterer.com/",
    kind: "press",
    region: "uk",
    weight: 8,
    contactNote:
      "Highest-authority UK hospitality title in this list and correspondingly hard to land cold. Needs a genuine news hook — funding, a named customer, or original data. Park until there is one.",
    angle:
      "Reach and authority. Realistically a later target: pitching it now, with nothing to announce, wastes the one introduction we get.",
  },

  // ── Communities ─────────────────────────────────────────────────────────
  {
    name: "r/restaurateur",
    url: "https://www.reddit.com/r/restaurateur/",
    kind: "community",
    region: "general",
    weight: 4,
    contactNote:
      "No link value (nofollow) and self-promotion gets removed. Value is discovery and language: read how owners describe the scheduling problem in their own words and feed that back into the site copy.",
    angle:
      "Answer questions as a former chef who built a tool, never as a vendor. Slow, but it is where the actual buyers complain out loud.",
  },
  {
    name: "Institute of Hospitality",
    url: "https://www.instituteofhospitality.org/",
    kind: "community",
    region: "uk",
    weight: 5,
    contactNote: "Professional body with its own magazine. Membership may open a contributor route.",
    angle: "Credibility with UK hospitality managers, plus a possible bylined slot in the member magazine.",
  },
];

async function main() {
  let created = 0;
  let updated = 0;

  for (const r of ROWS) {
    const existing = await prisma.linkProspect.findUnique({ where: { url: r.url } });

    // Refresh only the research fields. status/liveUrl/sentAt/notes are yours —
    // a seed script that resets progress is worse than one that never runs.
    const research = {
      name: r.name,
      kind: r.kind,
      region: r.region,
      weight: r.weight,
      contactEmail: r.contactEmail ?? null,
      contactName: r.contactName ?? null,
      contactNote: r.contactNote ?? null,
      angle: r.angle,
    };

    if (existing) {
      await prisma.linkProspect.update({ where: { url: r.url }, data: research });
      updated++;
    } else {
      await prisma.linkProspect.create({ data: { url: r.url, ...research } });
      created++;
    }
  }

  const byKind = await prisma.linkProspect.groupBy({ by: ["kind"], _count: true });
  console.log(`seeded: ${created} created, ${updated} refreshed`);
  for (const k of byKind) console.log(`  ${k.kind}: ${k._count}`);
  console.log(`total: ${await prisma.linkProspect.count()}`);
}

main().finally(() => prisma.$disconnect());
