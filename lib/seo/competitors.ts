/**
 * Competitor data for the /compare pages.
 *
 * RULES FOR EDITING THIS FILE — read before changing a number.
 *
 * 1. Only use pricing the vendor publishes on their OWN site. Third-party
 *    aggregators (Capterra, G2, SoftwareSuggest) contradict each other wildly
 *    and are frequently years stale.
 * 2. Every entry carries `pricingSource` and `pricingChecked`. If you can't
 *    cite it, don't claim it.
 * 3. Where a vendor doesn't publish pricing, say so. "Pricing on request" is
 *    accurate and is itself useful information for a buyer.
 * 4. Never overstate a weakness. These are named, trading companies; a false
 *    factual claim about a competitor is a legal risk, not just a credibility
 *    one. Where we're not certain, the honest line is that they don't market
 *    the feature — not that it doesn't exist.
 * 5. Every page must include a genuine `whereTheyWin`. A comparison with no
 *    losses reads as marketing and converts worse than an honest one.
 */

export interface Competitor {
  slug: string;
  name: string;
  /** Short label for table headers. */
  short: string;
  /** One-line positioning, neutral in tone. */
  positioning: string;
  pricingModel: "per-user" | "per-location" | "flat" | "on-request";
  /** Human-readable, exactly as the vendor states it. */
  pricingSummary: string;
  pricingSource: string;
  pricingChecked: string;
  /** Worked monthly cost for a 12-staff single venue, or null if unpublished. */
  exampleCost12: string | null;
  /** Honest list of what they genuinely do better or differently. */
  whereTheyWin: string[];
  /** Gaps for a small independent hospitality venue. */
  gaps: string[];
  /** The one-sentence honest summary. */
  verdict: string;
  /** Who should genuinely pick them over Rotahr. */
  pickThemIf: string;
  faqs: { q: string; a: string }[];
}

export const ROTAHR_PRICING = {
  starter: 59,
  pro: 119,
  enterprise: 215,
  currency: "EUR",
  note: "Flat monthly, VAT included. Starter up to 15 staff, Pro up to 30.",
};

export const competitors: Competitor[] = [
  {
    slug: "bizimply",
    name: "Bizimply",
    short: "Bizimply",
    positioning:
      "Irish-founded workforce management for hospitality and retail, strong in multi-site operations.",
    pricingModel: "on-request",
    pricingSummary:
      "Not published. Bizimply's pricing page states cost depends on employee count, number of locations and which products you buy, with a discount for annual billing.",
    pricingSource: "https://www.bizimply.com/pricing/",
    pricingChecked: "2026-08-02",
    exampleCost12: null,
    whereTheyWin: [
      "Longer track record and a large installed base of Irish and UK venues, including well-known multi-site groups.",
      "Mature manager tooling built up over years — shift logs, HR document handling and detailed attendance reporting.",
      "A dedicated account and support team, which suits groups that want hands-on onboarding.",
      "Established payroll and EPOS integrations across the Irish market.",
    ],
    gaps: [
      "No published pricing, so you have to go through a sales conversation before you know what it costs.",
      "Scoped as workforce management — food safety records, bookkeeping and table reservations sit outside it, so you keep paying for those separately.",
      "Priced by headcount and location, so the bill grows as you hire.",
    ],
    verdict:
      "The strongest incumbent in Irish hospitality workforce management. If rota, attendance and HR is all you want and you're happy going through sales, they're a serious option.",
    pickThemIf:
      "You run several sites, want a named account manager, and already have separate systems for food safety and accounts that you're not planning to replace.",
    faqs: [
      {
        q: "Is Rotahr cheaper than Bizimply?",
        a: "Bizimply doesn't publish its pricing, so nobody can give you an honest comparison without a quote. Rotahr is flat: €59/month up to 15 staff, €119 up to 30, VAT included. The difference that tends to matter more is that Rotahr's price doesn't move when you hire.",
      },
      {
        q: "What does Rotahr do that Bizimply doesn't?",
        a: "HACCP food safety logging, receipt scanning and bookkeeping, table reservations with a floor plan, and a customer list for offers. Bizimply focuses on workforce management, so those are usually separate tools in a Bizimply venue.",
      },
      {
        q: "Can I move my rota from Bizimply to Rotahr?",
        a: "Yes. Staff and rota data can be imported from a CSV export, which Bizimply supports. Most single-site venues are set up the same day.",
      },
    ],
  },
  {
    slug: "rotacloud",
    name: "RotaCloud",
    short: "RotaCloud",
    positioning:
      "UK rota and time-tracking software aimed at small and growing teams across many industries.",
    pricingModel: "per-user",
    pricingSummary:
      "Published per-user. RotaCloud lists a Standard plan from £2 per user per month, with Pro from £10/month covering up to 5 employees, and Time & Attendance as a paid addition.",
    pricingSource: "https://rotacloud.com/pricing/",
    pricingChecked: "2026-08-02",
    exampleCost12: "Around £24/month at 12 staff on Standard, before the Time & Attendance addition.",
    whereTheyWin: [
      "Genuinely cheap for rota alone at small headcounts — hard to beat on that single job.",
      "Very simple to learn; a manager can build a first rota within the hour.",
      "Well-regarded support and a clean mobile app.",
      "Not tied to hospitality, which suits mixed operations.",
    ],
    gaps: [
      "Rota, attendance and time-off only. No food safety records, no bookkeeping, no reservations.",
      "Per-user pricing plus the attendance add-on means the real bill climbs with headcount.",
      "Built for scheduling generally rather than hospitality specifically, so kitchen and floor workflows aren't modelled.",
    ],
    verdict:
      "If all you want is a cheap, tidy rota and nothing else, RotaCloud is honestly good value and we'd say so.",
    pickThemIf:
      "Rota is your only problem, your headcount is small and stable, and you have no interest in replacing your paper food safety diary or your bookkeeping.",
    faqs: [
      {
        q: "Is RotaCloud cheaper than Rotahr?",
        a: "For rota on its own at a small headcount, usually yes — and we'd rather say that than pretend otherwise. The comparison changes if you're also paying for a food safety system, a bookings tool and an accountant to sort a bag of receipts, because those are included in Rotahr.",
      },
      {
        q: "Does RotaCloud handle HACCP or food safety?",
        a: "No. It's rota, attendance and time off. Food safety records stay wherever they are now, usually on paper.",
      },
      {
        q: "Why would a pub pick Rotahr over RotaCloud?",
        a: "Because a pub's problem usually isn't only the rota. It's the rota, the temperature checks, the delivery notes, the bookings and the receipts. Rotahr covers all of those in one flat monthly price.",
      },
    ],
  },
  {
    slug: "deputy",
    name: "Deputy",
    short: "Deputy",
    positioning:
      "Global shift-work platform used across hospitality, retail and healthcare, strong on scheduling and compliance.",
    pricingModel: "per-user",
    pricingSummary:
      "Published per-user. Deputy lists Lite at $5, Core at $6.50 and Pro at $9 per user per month (USD, excluding applicable taxes), with add-ons priced separately.",
    pricingSource: "https://www.deputy.com/pricing",
    pricingChecked: "2026-08-02",
    exampleCost12: "Around $78/month at 12 staff on Core, before add-ons or tax.",
    whereTheyWin: [
      "Best-in-class scheduling engine with demand forecasting and auto-scheduling.",
      "Deep integration ecosystem — POS, payroll and HR systems across many countries.",
      "Very mature compliance handling across multiple jurisdictions, useful if you operate in several.",
      "Proven at scale, with enterprise-grade reporting and permissions.",
    ],
    gaps: [
      "Per-user, in USD, with tax on top — the bill is both headcount-linked and exposed to exchange rates for an Irish venue.",
      "Workforce management only. Reservations, food safety and bookkeeping are outside its scope.",
      "More product than a 10-person pub needs, and the configuration effort reflects that.",
    ],
    verdict:
      "The most capable scheduler of the group. Also the one most likely to be overkill for a single independent venue.",
    pickThemIf:
      "You have complex scheduling across multiple sites or countries, want forecasting and auto-scheduling, and have someone with time to configure it properly.",
    faqs: [
      {
        q: "Is Deputy or Rotahr better for a small pub?",
        a: "For a single pub under 15 staff, Rotahr is the closer fit — it's flat-priced and covers the food safety and bookkeeping side too. Deputy's scheduling is more powerful, but most of that power is aimed at larger, more complex operations.",
      },
      {
        q: "How does Deputy's pricing compare?",
        a: "Deputy publishes per-user pricing in USD — Lite $5, Core $6.50, Pro $9 per user per month, excluding tax. Rotahr is a flat €59/month up to 15 staff and €119 up to 30, VAT included, so the cost is fixed whatever your headcount does.",
      },
      {
        q: "Does Deputy do table bookings?",
        a: "No. Deputy is workforce management. Table reservations and a floor plan are part of Rotahr.",
      },
    ],
  },
  {
    slug: "planday",
    name: "Planday",
    short: "Planday",
    positioning:
      "Xero-owned scheduling and workforce platform popular with European hospitality and retail.",
    pricingModel: "per-user",
    pricingSummary:
      "Published per-user with minimums. Planday lists Starter at $2.99 per user/month with a 5-user minimum, and Plus at $4.49 per user/month plus a $15 monthly subscription fee with a 10-user minimum. Pro is quoted on request.",
    pricingSource: "https://www.planday.com/pricing",
    pricingChecked: "2026-08-02",
    exampleCost12: "Around $69/month at 12 staff on Plus, including the $15 monthly fee.",
    whereTheyWin: [
      "Owned by Xero, so the accounting integration is genuinely tight if you already use Xero.",
      "Strong payroll handling and a solid European compliance footing.",
      "Good staff-facing app with availability and swap handling.",
      "Established across multiple European markets.",
    ],
    gaps: [
      "Per-user plus platform fee and seat minimums, so a small venue can pay for seats it doesn't use.",
      "No food safety, reservations or receipt capture.",
      "Accounting depends on a Xero subscription alongside it, which is a second bill.",
    ],
    verdict:
      "A sensible pick if you're already committed to Xero and want scheduling that plugs straight into it.",
    pickThemIf:
      "You already run Xero and have an accountant who wants you to stay in that ecosystem.",
    faqs: [
      {
        q: "Planday vs Rotahr — which suits a restaurant better?",
        a: "Planday is scheduling and payroll that connects to Xero. Rotahr is scheduling plus HACCP, bookings and bookkeeping in one flat price. If you already pay for Xero and like it, Planday fits neatly. If you'd rather not run two subscriptions, Rotahr covers more of the job.",
      },
      {
        q: "Does Planday include food safety records?",
        a: "No. Temperature checks, cleaning schedules and delivery records aren't part of it.",
      },
    ],
  },
  {
    slug: "7shifts",
    name: "7shifts",
    short: "7shifts",
    positioning:
      "Restaurant-specific team management platform, strongest in the North American market.",
    pricingModel: "per-location",
    pricingSummary:
      "Published per-location. 7shifts lists Essentials at $39.99 and Pro at $79.99 per month per location, with a Premium tier around $134.99–$149.99 per month per location, plus $6 per employee paid for payroll.",
    pricingSource: "https://www.7shifts.com/pricing/",
    pricingChecked: "2026-08-02",
    exampleCost12: "From $39.99/month per location on Essentials, rising with tier rather than headcount.",
    whereTheyWin: [
      "Per-location rather than per-user, so headcount doesn't inflate the bill — the same principle as Rotahr.",
      "Built specifically for restaurants, with tip handling and task management baked in.",
      "Excellent US POS integration coverage.",
      "Strong labour forecasting tied to sales data.",
    ],
    gaps: [
      "Very US-centric — tip credit, US payroll taxes and US labour rules are the design centre, which maps poorly onto Irish and UK requirements.",
      "No HACCP-style food safety module for EU/UK inspection expectations.",
      "Priced in USD, and the cheaper tiers cap what you get.",
    ],
    verdict:
      "Genuinely good software aimed at a different market. The gap for an Irish or UK venue is regulatory, not quality.",
    pickThemIf:
      "You operate in North America, or you want tip pooling and US payroll handled natively.",
    faqs: [
      {
        q: "Does 7shifts work for Irish or UK restaurants?",
        a: "It works, but it's designed around US rules — tip credit, US payroll taxes, US labour law. Irish and UK specifics like Sunday premium, Irish public holiday entitlement and HACCP inspection records aren't its focus.",
      },
      {
        q: "Is 7shifts per user or per location?",
        a: "Per location, which is one of its better traits — hiring more staff doesn't raise the price. Rotahr works the same way, with a flat monthly fee by staff band.",
      },
    ],
  },
  {
    slug: "sling",
    name: "Sling",
    short: "Sling",
    positioning:
      "Free-tier scheduling tool from Toast, aimed at small teams wanting basic shift planning.",
    pricingModel: "per-user",
    pricingSummary:
      "Sling offers a free tier for basic scheduling, with paid tiers adding time tracking and labour reporting. Check their pricing page for current per-user rates.",
    pricingSource: "https://getsling.com/pricing/",
    pricingChecked: "2026-08-02",
    exampleCost12: "Free tier available; paid tiers priced per user.",
    whereTheyWin: [
      "There is a genuinely free tier, which nothing else here offers.",
      "Simple and quick for basic shift planning and staff messaging.",
      "Owned by Toast, so it fits naturally if you run Toast POS.",
    ],
    gaps: [
      "The free tier is scheduling and messaging — reporting, attendance depth and compliance sit behind paid tiers.",
      "No food safety, bookkeeping or reservations.",
      "Not built around Irish or UK employment rules.",
    ],
    verdict:
      "If your budget is genuinely zero, start here. It'll do a basic rota and it costs nothing, and that's a fair thing to say.",
    pickThemIf:
      "You're brand new, running on nothing, and just need to stop texting shifts to people.",
    faqs: [
      {
        q: "Is there a free alternative to Rotahr?",
        a: "Sling has a free tier for basic scheduling. It won't handle food safety records, bookings or your books, but if budget is the constraint it's an honest starting point.",
      },
    ],
  },
  {
    slug: "rotaready",
    name: "Rotaready",
    short: "Rotaready",
    positioning:
      "Hospitality scheduling from Access Group, usually sold as part of a wider Access Hospitality suite.",
    pricingModel: "on-request",
    pricingSummary:
      "Not published as a simple list price. Access provides a calculator and typically prices Rotaready Evo as part of a Hospitality suite rather than a standalone subscription.",
    pricingSource:
      "https://www.theaccessgroup.com/en-gb/our-brands/rotaready-evo/pricing/",
    pricingChecked: "2026-08-02",
    exampleCost12: null,
    whereTheyWin: [
      "Deep labour forecasting and cost control, aimed squarely at multi-site hospitality.",
      "Part of the Access ecosystem, so EPOS, finance and HR can sit under one vendor.",
      "Strong integrations with hospitality-specific systems including ResDiary and Access EPoS.",
      "Suited to groups with a finance team that wants detailed labour analysis.",
    ],
    gaps: [
      "Aimed at multi-site groups; a single independent venue is not the target customer.",
      "Pricing is quote-based and generally bundled, which makes it hard to compare or leave.",
      "Suite buying means you're committing to a vendor relationship, not a monthly app.",
    ],
    verdict:
      "Built for hospitality groups with a head office. If you're one venue with twelve staff, you're not who it's designed for.",
    pickThemIf:
      "You run a group, want one vendor across EPOS, finance and scheduling, and have the head-office capacity to run it.",
    faqs: [
      {
        q: "Is Rotaready suitable for a single pub or café?",
        a: "It's built for multi-site hospitality groups with head-office reporting needs. A single venue will find it heavier and harder to price than a flat monthly app.",
      },
      {
        q: "How much does Rotaready cost?",
        a: "Access doesn't publish a simple list price — it's quoted, usually as part of their wider Hospitality suite. Rotahr publishes its pricing openly: €59/month up to 15 staff, €119 up to 30, VAT included.",
      },
    ],
  },
  {
    slug: "ordio",
    name: "Ordio",
    short: "Ordio",
    positioning:
      "German workforce platform for shift-based teams — scheduling, time tracking, employee file and payroll, sold per location.",
    pricingModel: "per-location",
    pricingSummary:
      "Published per location, per month on annual billing: Starter €89, Plus €129, Pro €169, Enterprise from €344. Time tracking is not in Starter — it begins at Plus. Checklists begin at Pro. Net payroll is a €15 add-on.",
    pricingSource: "https://www.ordio.com/en/pricing",
    pricingChecked: "2026-08-16",
    exampleCost12:
      "€89/month for one venue on Starter, but without time tracking. With clock-in you are on Plus at €129/month. Headcount does not change either figure.",
    whereTheyWin: [
      "Founder-led hospitality credibility — David Keuenhof built it while running rotas and payroll for 125 staff across three Sushi Ninja sites in Cologne.",
      "Payroll is calculated in the product rather than only prepared for an accountant, with a paid add-on for net pay.",
      "A real integration surface: a public REST JSON API, partner integrations and their own app store. Rotahr has fewer published integrations today.",
      "Hardware-grade time tracking on the upper tiers — tablet team terminal, optional GPS check, digital signature verification and documented late arrivals.",
      "Documents and e-signature, plus a document generator on Enterprise.",
      "Scale and breadth: they state 2,500+ businesses across more than 72 industries, so the product is well proven outside hospitality too.",
    ],
    gaps: [
      "Priced per location, so the bill multiplies with venues. Three sites on Plus is €387/month before add-ons.",
      "Time tracking is withheld from the entry tier, so the realistic hospitality price is the €129 Plus plan rather than the €89 headline.",
      "Nothing for front of house. No table reservations, no floor plan and no customer list, so the diary stays in a second system.",
      "No food safety module in the core product — HACCP temperature and cleaning records are not what it is built to hold.",
      "Built for German rules and marketed to teams in Germany; their own scheduling page still offers a free start “when Ordio launches in your region”, so Irish and UK availability should be confirmed before you plan around it.",
    ],
    verdict:
      "A strong, well-built workforce platform that happens to serve hospitality, rather than a hospitality system. If you only need staff operations and you are in Germany, they are a genuinely good product.",
    pickThemIf:
      "You operate in Germany, want payroll calculated rather than prepared, need an open API to plug into existing systems, and you already have reservations and food safety handled elsewhere.",
    faqs: [
      {
        q: "Is Rotahr cheaper than Ordio?",
        a: "For a single venue that needs clock-in, yes. Ordio puts time tracking on its Plus plan at €129 per location per month; Rotahr Starter is €59 a month including VAT with clock-in and break tracking in the box. The gap widens with venues, because Ordio charges per location and Rotahr Enterprise is €215 flat for unlimited sites.",
      },
      {
        q: "What does Rotahr do that Ordio does not?",
        a: "Front of house and food safety. Table bookings with a visual floor plan, a customer list built from reservations, and HACCP temperature, delivery and cleaning records with PDF export for inspections. Ordio is a workforce platform, so those stay in separate tools.",
      },
      {
        q: "What does Ordio do that Rotahr does not?",
        a: "It calculates payroll rather than preparing it, publishes a REST API with an app store of integrations, and offers e-signature and a tablet clock-in terminal. If those matter more to you than reservations and HACCP, Ordio is the better fit.",
      },
      {
        q: "Is Ordio available in Ireland and the UK?",
        a: "Ordio markets itself to teams in Germany and its site refers to a free start when Ordio launches in your region, so availability outside the German-speaking market is worth confirming with them directly. Rotahr is built around Irish and UK rules — statutory break entitlements, VAT and Form 46G — and also supports USD, GBP, CAD and AUD.",
      },
      {
        q: "There seem to be two products called ordio — which is which?",
        a: "There are. ordio.com is the German workforce platform described on this page. getordio.com is a separate, unrelated vendor aimed at US restaurants, selling a single plan at $125 per location per month for up to 25 users, with prep lists, inventory and invoice processing. If you are comparing quotes, check which one you are actually talking to.",
      },
    ],
  },
];

export function getCompetitor(slug: string) {
  return competitors.find((c) => c.slug === slug);
}
