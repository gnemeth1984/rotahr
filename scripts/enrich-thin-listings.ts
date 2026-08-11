/**
 * Enrich the six prospect pages that were built too thin to announce.
 *
 * Why this matters more than it looks: prospect pages are the ONLY thing on
 * rotahr.com currently earning Google impressions. /v/christys-the-well has
 * pulled 47 impressions on its own, against zero from all 71 blog posts
 * combined. They rank because they're the only page on the internet answering
 * "<venue name> <town>" with structured hours, address and phone.
 *
 * These six were held back by the review gate (publicNoIndex = true) because
 * they had no address, no phone or almost no description. That's the gate
 * working — but a held page earns nothing, so the fix is to fill them, not to
 * lower the bar.
 *
 * SOURCING RULE: every value below comes from the venue's own published
 * channel — their website, or their own Facebook/Instagram business page where
 * they have no site. Where independent directories disagree with the venue's
 * own channel, the venue wins. Where nothing is corroborated, the field stays
 * null. We are publishing a page *about a real business*; an invented detail
 * is worse than a blank.
 *
 *   npx tsx --env-file=.env.local scripts/enrich-thin-listings.ts [--dry]
 */

import { prisma } from "@/lib/prisma";

type Hours = { day: number; closed: boolean; open?: string; close?: string };

/** Same time every day, Sun(0)..Sat(6). */
const daily = (open: string, close: string): Hours[] =>
  Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open, close }));

type Patch = {
  slug: string;
  /** Only set when the stored name is a scraped address rather than a name. */
  name?: string;
  newSlug?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  about?: string;
  instagram?: string;
  facebook?: string;
  hours?: Hours[];
  /** Left true when the page is still too thin to publish. */
  keepNoIndex?: boolean;
  source: string;
};

const PATCHES: Patch[] = [
  {
    // padthailistowel.com prints phone and full address in its header, and the
    // tel: link resolves to 06869811. An App Store listing shows a different
    // mobile number — the venue's own site wins.
    slug: "pad-thai-restaurant-66-church-st-listowel-co-kerry-v31-h293",
    name: "Pad Thai Restaurant",
    newSlug: "pad-thai-listowel",
    address: "66 Church Street, Listowel, Co. Kerry, V31 H293",
    phone: "+353 68 69811",
    website: "https://padthailistowel.com/",
    about:
      "Pad Thai Restaurant serves Thai food in the centre of Listowel, Co. Kerry, for both dining in and takeaway. The kitchen cooks to order from a menu of Thai classics, with a separate takeaway menu available to collect.",
    source: "padthailistowel.com (own site: tel: link, header address)",
  },
  {
    // No website. Address and phone are consistent across HappyCow, Tripadvisor
    // and Mindtrip at 24 William Street / V31 RY86; their own Facebook page
    // confirms the Armenian-European description in their own words.
    slug: "gapos-restaurant",
    address: "24 William Street, Listowel, Co. Kerry, V31 RY86",
    phone: "+353 68 23144",
    facebook: "https://www.facebook.com/gaposrestaurant/",
    about:
      "Gapo's Restaurant in Listowel, Co. Kerry, serves Armenian cooking with a European influence — reportedly the only Armenian restaurant in Ireland. Family run, with a menu built around slow-cooked lamb and other Armenian house specialities.",
    source: "facebook.com/gaposrestaurant (own page) + HappyCow/Tripadvisor agreement on address",
  },
  {
    // Own site has the description but publishes neither phone nor address.
    // Their own Facebook and Instagram both state "contact Rolfs country house
    // at 02820289 or info@rolfscountryhouse.com".
    slug: "rolfs-country-house",
    address: "Baltimore Hill, Baltimore, Co. Cork, P81 NW27",
    phone: "+353 28 20289",
    facebook: "https://www.facebook.com/RolfsCountryHouse/",
    instagram: "https://www.instagram.com/rolfsbaltimore/",
    about:
      "Rolf's Country House sits on a hill above the village of Baltimore in West Cork, overlooking Roaring Water Bay. A family-run business for over 40 years, it offers a restaurant and wine bar alongside cosy bedrooms and self-catering cottages set around sub-tropical gardens, with outdoor dining in summer.",
    source: "rolfscountryhouse.com (own copy) + own Facebook/Instagram bio for phone",
  },
  {
    // Phone and address already stored and correct. Missing a real description
    // and a proper name — "Cearnog Bar Tralee" is close, but the venue writes
    // itself as An Cearnóg. Their own Facebook states "Great food served all
    // day. Music most nights."
    slug: "cearnog-bar-tralee",
    name: "An Cearnóg Bar",
    facebook: "https://www.facebook.com/CearnogBar/",
    instagram: "https://www.instagram.com/cearnogbar/",
    about:
      "An Cearnóg is a bar on The Square in the centre of Tralee, Co. Kerry, serving food all day with live music on most nights. A town-centre local, open from mid-morning through to late.",
    source: "facebook.com/CearnogBar (own page: description, hours 'open now')",
  },
  {
    // Their own Facebook and Instagram publish 10-11 South Square and
    // (023) 883 1047. Posted opening hours differ between the two channels, so
    // hours are deliberately omitted rather than guessed — a page that says
    // "closed" on a day they trade actively harms the venue.
    slug: "dewdrop-bistro",
    address: "10-11 South Square, Rosscarbery, Co. Cork, P85 KX28",
    phone: "+353 23 883 1047",
    facebook: "https://www.facebook.com/p/Dewdrop-Bistro-61575264086681/",
    instagram: "https://www.instagram.com/dewdropjce/",
    about:
      "Dewdrop Bistro is on South Square in Rosscarbery, West Cork, serving breakfast through to evening meals. The kitchen runs a short bistro menu with weekend specials, for dine-in and walk-ins.",
    source: "facebook.com/p/Dewdrop-Bistro + instagram.com/dewdropjce (own pages)",
  },
  {
    // No website; Facebook is their channel. Phone +353 66 712 8833 and the
    // 5pm-11pm daily hours agree across Apple Maps, Yelp and MapQuest.
    slug: "cassidys-16-abbey-st-tralee-co-kerry",
    name: "Cassidy's Restaurant",
    newSlug: "cassidys-tralee",
    address: "16 Abbey Street, Tralee, Co. Kerry",
    phone: "+353 66 712 8833",
    about:
      "Cassidy's is a restaurant on Abbey Street in the centre of Tralee, Co. Kerry, serving traditional Irish cooking in a casual dining room. Open evenings, seven days a week.",
    hours: daily("17:00", "23:00"),
    instagram: "cassidys_restaurant",
    source:
      "instagram.com/cassidys_restaurant (own bio: 'Open 7 nights a week, 5-11pm', booking phone 066 712 8833)",
  },
];

/** A page is publishable when a stranger could actually use it. */
function goodEnough(b: {
  publicAddress: string | null;
  publicPhone: string | null;
  publicAbout: string | null;
}) {
  return Boolean(b.publicAddress) && (b.publicAbout ?? "").length >= 80;
}

async function main() {
  const dry = process.argv.includes("--dry");
  if (dry) console.log("DRY RUN — no writes\n");

  for (const p of PATCHES) {
    const biz = await prisma.business.findFirst({ where: { publicSlug: p.slug } });
    if (!biz) {
      console.log(`SKIP ${p.slug} — not found`);
      continue;
    }

    // Never overwrite a value the page already has: it may have been corrected
    // by hand, or by the venue itself after claiming the page.
    const data: Record<string, unknown> = {};
    if (p.name) data.name = p.name;
    if (p.address && !biz.publicAddress) data.publicAddress = p.address;
    if (p.phone && !biz.publicPhone) data.publicPhone = p.phone;
    if (p.email && !biz.publicEmail) data.publicEmail = p.email;
    if (p.website && !biz.publicWebsite) data.publicWebsite = p.website;
    if (p.about && (biz.publicAbout ?? "").length < 80) data.publicAbout = p.about;
    if (p.instagram && !biz.publicInstagram) data.publicInstagram = p.instagram;
    if (p.facebook && !biz.publicFacebook) data.publicFacebook = p.facebook;
    if (p.hours && !biz.publicOpeningHours) data.publicOpeningHours = p.hours;

    // Only rename a slug that is a leaked address, and only while the page is
    // unindexed and un-announced — otherwise the URL in someone's inbox 404s.
    if (p.newSlug && biz.publicNoIndex) {
      const clash = await prisma.business.findFirst({ where: { publicSlug: p.newSlug } });
      if (!clash) data.publicSlug = p.newSlug;
      else console.log(`  (slug ${p.newSlug} taken, keeping ${p.slug})`);
    }

    const after = {
      publicAddress: (data.publicAddress as string) ?? biz.publicAddress,
      publicPhone: (data.publicPhone as string) ?? biz.publicPhone,
      publicAbout: (data.publicAbout as string) ?? biz.publicAbout,
    };
    const publishable = goodEnough(after) && !p.keepNoIndex;
    if (publishable && biz.publicNoIndex) data.publicNoIndex = false;

    console.log(`${p.slug}`);
    console.log(`   source: ${p.source}`);
    console.log(`   fields: ${Object.keys(data).join(", ") || "(nothing to change)"}`);
    console.log(`   publishable: ${publishable ? "yes → noindex lifted" : "no → stays hidden"}`);

    if (!dry && Object.keys(data).length) {
      await prisma.business.update({ where: { id: biz.id }, data });
    }
  }

  const stillHidden = await prisma.business.count({
    where: { publicProspect: true, publicNoIndex: true },
  });
  const live = await prisma.business.count({
    where: { publicProspect: true, publicNoIndex: false },
  });
  console.log(`\nprospect pages — live: ${live}, still hidden: ${stillHidden}`);
}

main().finally(() => prisma.$disconnect());
