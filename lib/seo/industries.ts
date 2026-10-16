/**
 * Industry landing pages — one per venue type.
 *
 * Phase 1 growth scope: restaurant, bar and hotel ship first; cafe and
 * catering ship in the same release. Deliberately NOT a doorway pattern —
 * each entry below is written around how that specific vertical actually
 * runs (what the rota looks like, which compliance paperwork bites, which
 * module is the deciding factor), not a template with the noun swapped. See
 * the same warning in locations.ts and features.ts.
 *
 * Each page links into the existing /features/[slug] module pages and
 * /templates/[slug] free downloads rather than re-explaining either — the
 * job of this page is "is this built for my type of venue", not a second
 * copy of the features index.
 */

export interface IndustryFaq {
  q: string;
  a: string;
}

export interface IndustryPainPoint {
  title: string;
  detail: string;
}

export interface Industry {
  slug: string;
  /** Nav / card label. */
  name: string;
  /** H1. A claim, not a noun. */
  heading: string;
  /** Title tag, under 60 chars including " | Rotahr". */
  title: string;
  metaDescription: string;
  /** First sentence of the page body — answers the H1 directly. */
  answer: string;
  /** Body paragraphs after the answer. */
  body: string[];
  /** Specific operational pressure points for this vertical. */
  painPoints: IndustryPainPoint[];
  /** Feature module slugs most relevant to this vertical, in order. */
  relevantFeatures: string[];
  /** Free template slugs most relevant to this vertical. */
  relevantTemplates: string[];
  /** Who within the vertical this is the deciding factor for. */
  bestFor: string;
  faq: IndustryFaq[];
}

export const industries: Industry[] = [
  {
    slug: "restaurant",
    name: "Restaurants",
    heading: "Restaurant scheduling, HACCP and bookings in one app",
    title: "Restaurant Management Software — Rota, HACCP, CRM | Rotahr",
    metaDescription:
      "Rotahr for restaurants: staff rota and clock-in, HACCP temperature logs, table bookings, recipe costing and payroll hours — one app, flat monthly price, 3 months free.",
    answer:
      "Rotahr runs a restaurant's rota, food-safety paperwork, table bookings and recipe costing from one app, so a kitchen that changes every service doesn't need four different tools to stay on top of it.",
    body: [
      "A restaurant's rota is wrong by Tuesday. A delivery runs late, a commis calls in sick, a six-top turns into a twenty-cover party booking, and the kitchen that was fully staffed on Sunday is suddenly down a pair of hands on Thursday. Rotahr is built around that churn — shift templates make a stable week fast to lay down, and swaps, no-shows and sickness get absorbed without a group chat.",
      "Food safety is the paperwork that actually gets checked. Fridge and freezer temperature logs, delivery checks and cooking/cooling records live on a phone instead of a clipboard by the pass, with corrective actions recorded at the point something goes out of range — not reconstructed from memory before an inspection.",
      "Recipe costing closes the loop between the kitchen and the P&L: cost a dish from its ingredients, see the margin move when a supplier price changes, and know which specials are actually worth running before you print them on a board.",
      "None of this replaces your POS or payroll bureau — it feeds them. The rota and clock-in produce the hours; your existing systems still do payments and payslips.",
    ],
    painPoints: [
      {
        title: "The rota changes mid-week, every week",
        detail:
          "Shift templates and swap requests that route through a manager mean a changed rota is still one source of truth, not a thread of messages nobody can find on the night.",
      },
      {
        title: "An inspector can ask for the diary at any time",
        detail:
          "Temperature logs, delivery checks and corrective actions are timestamped as they happen, so the record exists before anyone asks for it — not reconstructed the morning of a visit.",
      },
      {
        title: "A busy service needs the booking sheet and the floor to agree",
        detail:
          "Table bookings, party sizes and special requests sit next to the rota, so front of house knows cover before the first guest arrives.",
      },
      {
        title: "Specials get priced by feel, not by margin",
        detail:
          "Recipe costing shows what a dish actually costs the moment a supplier price moves, so a special that looked good on paper doesn't quietly lose money all month.",
      },
    ],
    relevantFeatures: [
      "staff-scheduling",
      "haccp-food-safety",
      "table-bookings",
      "stock-recipe-costing",
      "time-tracking-payroll",
    ],
    relevantTemplates: [
      "kitchen-opening-closing-checklist",
      "fridge-freezer-temperature-log",
      "delivery-check-record",
      "weekly-staff-rota",
    ],
    bestFor:
      "Independent and small-group restaurants where the kitchen and front of house share one rota, one HACCP diary and one booking sheet, and a manager needs all three on their phone.",
    faq: [
      {
        q: "Does Rotahr replace my POS?",
        a: "No. Rotahr handles staffing, food safety, bookings, recipe costing and the hours that feed payroll. Sales, payments and the till stay on your POS — Square connects directly for sales-driven stock and staffing data.",
      },
      {
        q: "Can front of house and kitchen see different things?",
        a: "Yes. Staff see their own shifts, hours and swap requests. Managers see the full rota, wage cost as it builds, HACCP records and bookings. Role-based access means a server doesn't need to see cost prices to do their job.",
      },
      {
        q: "Is the HACCP module accepted by inspectors?",
        a: "It digitises the same records an inspector already expects to see — temperature logs, delivery checks, corrective actions — timestamped and exportable. Acceptance of digital records varies by jurisdiction, so check your local environmental health rules; most accept a printed or exported copy either way.",
      },
    ],
  },
  {
    slug: "bar",
    name: "Bars & Pubs",
    heading: "Bar and pub scheduling with cellar checks built in",
    title: "Bar & Pub Management Software — Rota, Cellar, Stock | Rotahr",
    metaDescription:
      "Rotahr for bars and pubs: staff rota and clock-in, cellar and line-cleaning checks, stock counts and bookkeeping — one app, flat monthly price, 3 months free.",
    answer:
      "Rotahr runs a bar or pub's rota, cellar and line-cleaning checks, and stock counts from one app, so a wet-led venue isn't tracking its people and its draught lines in two different places.",
    body: [
      "A bar's rota lives and dies on peak hours — Thursday to Sunday carry the week, and getting that cover wrong costs more than a quiet Tuesday ever does. Rotahr's wage-cost view updates as you build the rota, so a bad weekend is visible before it's published, not at the end of the month when the numbers come in.",
      "Cellar checks and line cleaning are the paperwork that protects draught quality and the licence — logged on a phone at the point they're actually done, with a record you can show rather than a memory of having done it.",
      "Stock counts and wastage logs turn 'where did the margin go' from a guess into a number: par-level ordering stops the Friday scramble, and a spirit stocktake catches drift before it becomes a pattern.",
      "Clock-in with GPS geofencing means staff can only clock in when they're actually on-site — useful anywhere, but especially on a late shift where a few minutes either way adds up across a team.",
    ],
    painPoints: [
      {
        title: "Peak nights carry the whole week",
        detail:
          "Shift templates built around your actual peak pattern mean Thursday–Sunday get the cover they need without re-planning from scratch every week.",
      },
      {
        title: "Line cleaning gets skipped when it's busy",
        detail:
          "A cellar and line-cleaning checklist on a phone takes the same time as doing it from memory, and leaves a record that it happened.",
      },
      {
        title: "Stock drift is invisible until the bill lands",
        detail:
          "Regular stock counts and a spirit stocktake catch pour variance and wastage early, instead of discovering it in a monthly reconciliation.",
      },
      {
        title: "Casual and part-time staff need simple hours, not a system",
        detail:
          "Clock-in with geofencing and a straightforward payroll summary suit a team that's mostly part-time without asking anyone to learn complex software.",
      },
    ],
    relevantFeatures: [
      "staff-scheduling",
      "time-tracking-payroll",
      "stock-recipe-costing",
    ],
    relevantTemplates: [
      "cellar-check-line-cleaning-log",
      "spirit-stocktake-sheet",
      "bar-opening-closing-checklist",
      "stock-count-sheet",
    ],
    bestFor:
      "Bars and pubs where peak-night cover, cellar quality and stock control matter more than table service, and most of the team is part-time or casual.",
    faq: [
      {
        q: "Does Rotahr track draught line cleaning?",
        a: "Yes — the cellar and line-cleaning checklist records when lines were last cleaned, by whom, and flags anything overdue. It's a digital version of the same wall chart most cellars already keep.",
      },
      {
        q: "Can I run stock counts across more than one bar?",
        a: "Yes. Stock counts, wastage logs and par-level ordering work per venue, so a multi-site group sees each bar's numbers separately and rolled up.",
      },
      {
        q: "Is this suitable for a venue with mostly casual staff?",
        a: "Yes — clock-in with GPS geofencing and a flat payroll summary are built for a team where people's hours vary week to week, without needing anyone to be trained on complex rostering software.",
      },
    ],
  },
  {
    slug: "hotel",
    name: "Hotels",
    heading: "Hotel staff scheduling and housekeeping, in one app",
    title: "Hotel Staff Scheduling & Housekeeping Software | Rotahr",
    metaDescription:
      "Rotahr for hotels: staff rota across departments, housekeeping room checklists, guest incident logs, HACCP for the kitchen, and payroll hours — flat monthly price, 3 months free.",
    answer:
      "Rotahr schedules every department of a small hotel — front of house, housekeeping and kitchen — on one rota, with housekeeping checklists and guest incident logs alongside it, instead of a different system per department.",
    body: [
      "A hotel isn't one rota, it's three or four running at once — front desk, housekeeping, kitchen, maintenance — and they rarely talk to each other. Rotahr keeps every department's shifts, swaps and hours in one place, so a manager covering for someone off sick can see the whole building, not just their own section.",
      "Housekeeping runs on checklists that have to be done the same way whoever is on shift: room-by-room, section by section, with a sign-off that proves it happened. A guest incident log sits next to it for anything that needs a written record afterwards.",
      "If the hotel runs a kitchen, the same HACCP, recipe costing and bookings modules used by standalone restaurants apply directly — temperature logs, delivery checks and table or room-service bookings in the same app as the rota.",
      "Equipment and servicing tracks warranty and service history for the kit that's expensive to let lapse — laundry equipment, kitchen appliances, HVAC — with warnings before a service or warranty falls due.",
    ],
    painPoints: [
      {
        title: "Multiple departments, one building, no shared view",
        detail:
          "Front desk, housekeeping and kitchen rotas live in one app, so covering a gap in one department doesn't mean losing sight of the others.",
      },
      {
        title: "Room checks need to be identical every time",
        detail:
          "Housekeeping room checklists are the same list whoever's on shift, with a sign-off column that proves the check happened and when.",
      },
      {
        title: "A guest incident needs a written record, fast",
        detail:
          "A guest incident log captures what happened, when, and who dealt with it — in the format you'd want to hand to insurance or management afterwards.",
      },
      {
        title: "Kitchen compliance doesn't stop at the restaurant floor",
        detail:
          "If there's a kitchen on site, the same HACCP temperature logs and delivery checks used by standalone restaurants apply without a second system.",
      },
    ],
    relevantFeatures: [
      "staff-scheduling",
      "haccp-food-safety",
      "equipment-register",
      "time-tracking-payroll",
      "table-bookings",
    ],
    relevantTemplates: [
      "housekeeping-room-checklist",
      "guest-incident-log",
      "weekly-staff-rota",
      "fridge-freezer-temperature-log",
    ],
    bestFor:
      "Small and independent hotels running front desk, housekeeping and a kitchen on one site, where department heads need their own view but ownership needs the whole building.",
    faq: [
      {
        q: "Can different departments see only their own rota?",
        a: "Yes. Staff see their section's shifts; department heads and managers can see across front desk, housekeeping and kitchen on the same account, so covering a gap doesn't mean losing visibility of the rest of the building.",
      },
      {
        q: "Does the housekeeping checklist cover every room type?",
        a: "The checklist template is section-based (bathroom, bedroom, amenities, turndown) so it adapts to a standard room or a suite without needing a different sheet for each room type.",
      },
      {
        q: "Does Rotahr handle room service or restaurant bookings if we have a kitchen?",
        a: "Yes — the bookings module used by standalone restaurants works the same way for a hotel's own restaurant or room-service kitchen, alongside the same HACCP and recipe-costing modules.",
      },
    ],
  },
  {
    slug: "cafe",
    name: "Cafes",
    heading: "Cafe scheduling and food safety for small teams",
    title: "Cafe Scheduling & Food Safety Software | Rotahr",
    metaDescription:
      "Rotahr for cafes: staff rota, clock-in, HACCP temperature logs and simple bookkeeping — one flat-price app built for small teams, 3 months free.",
    answer:
      "Rotahr gives a cafe one app for the rota, clock-in, HACCP checks and basic bookkeeping, sized for a small team rather than a hundred-cover restaurant.",
    body: [
      "A cafe's rota is usually a handful of people covering open to close, often with the owner working alongside the team. Rotahr's shift templates and copy-week-to-week make a stable week fast to set, with swap requests handling the inevitable Saturday cover-swap without a text thread.",
      "Food safety still applies at cafe scale — fridge temperatures, delivery checks and a cleaning schedule — and the same templates used by larger kitchens scale down cleanly to a smaller space and a shorter prep list.",
      "Bookkeeping is the part that eats an owner-operator's evening: snap a receipt, let it read itself, and see cash position without a shoebox of paper at the end of the month.",
      "Training records help with a team that turns over quickly on seasonal or part-time staff — a short induction checklist is enough for most cafe roles, logged once rather than re-explained to every new starter.",
    ],
    painPoints: [
      {
        title: "A small team still needs a real rota",
        detail:
          "Shift templates and copy-week-to-week keep a 4–8-person rota fast to build without the overhead of software made for a much bigger operation.",
      },
      {
        title: "Food safety paperwork doesn't shrink with the venue",
        detail:
          "Temperature logs and delivery checks apply at any size — the same template just has fewer rows to fill in.",
      },
      {
        title: "Bookkeeping is the first thing an owner-operator drops",
        detail:
          "Receipt scanning and automatic expense tracking keep the books current without needing an evening set aside for it every week.",
      },
      {
        title: "Seasonal and part-time staff need a fast onboarding",
        detail:
          "A short induction checklist and training record mean a new starter is productive and documented on day one, not week three.",
      },
    ],
    relevantFeatures: [
      "staff-scheduling",
      "time-tracking-payroll",
      "haccp-food-safety",
      "bookkeeping-receipts",
    ],
    relevantTemplates: [
      "fridge-freezer-temperature-log",
      "daily-weekly-cleaning-schedule",
      "weekly-staff-rota",
      "new-staff-induction-checklist",
    ],
    bestFor:
      "Independent cafes with a small, often part-time team where the owner is still working shifts and needs the admin to take minutes, not evenings.",
    faq: [
      {
        q: "Is Rotahr worth it for a cafe with only a few staff?",
        a: "The flat monthly price and 3-month free trial are built for exactly this — unlike per-user pricing, a small team doesn't pay a premium for being small, and you can see whether it earns its place before paying anything.",
      },
      {
        q: "Do I need the full HACCP module for a cafe?",
        a: "Most cafes still handle food — temperature-controlled storage, deliveries, maybe a short prep list — so the same checks apply, just with fewer items. You use as much or as little of each module as your kitchen actually needs.",
      },
      {
        q: "Can I run this alongside a POS system?",
        a: "Yes. Rotahr handles staffing, food safety and bookkeeping; Square connects directly for sales data. Your till keeps doing payments either way.",
      },
    ],
  },
  {
    slug: "catering",
    name: "Catering",
    heading: "Catering staff scheduling for events and off-site jobs",
    title: "Catering Company Scheduling Software | Rotahr",
    metaDescription:
      "Rotahr for catering companies: event-based staff rotas, availability management, HACCP transport and holding records, and payroll hours — flat monthly price, 3 months free.",
    answer:
      "Rotahr schedules a catering company's casual and event staff around jobs rather than fixed shifts, with availability, swaps and HACCP holding records all in the same app.",
    body: [
      "Catering staffing isn't a weekly rota, it's a string of jobs with different crews, different venues and often different start times on the same day. Rotahr's availability feature lets staff declare when they can work, so building a job's crew starts from who's actually free rather than a round of phone calls.",
      "Food safety for catering has its own pressure points — holding temperatures, transport time, and reheating at an off-site venue — and the same temperature-log and reheat/hot-holding templates used by restaurant kitchens cover those checks away from a fixed kitchen.",
      "Casual and event staff often work for several employers, so clock-in and payroll hours need to be clean and exportable without assuming someone works the same job every week — Rotahr's hours summaries hand off cleanly to whatever payroll process the business already runs.",
      "Team messaging keeps job-day logistics — call times, venue addresses, last-minute changes — out of a personal group chat and inside the same app as the rota.",
    ],
    painPoints: [
      {
        title: "Every job has a different crew and venue",
        detail:
          "Availability declared by staff makes building a job's crew a filter, not a round of calls, and the rota reflects the actual job rather than a fixed weekly pattern.",
      },
      {
        title: "Food safety doesn't stop at the kitchen door",
        detail:
          "Reheat and hot-holding records cover food that travels to an off-site venue, which a fixed-kitchen HACCP diary usually doesn't address directly.",
      },
      {
        title: "Casual staff need clean hours, not a weekly contract",
        detail:
          "Clock-in and exportable payroll summaries work for people who pick up jobs rather than working a fixed weekly rota.",
      },
      {
        title: "Job-day logistics get lost in group chats",
        detail:
          "Team messaging keeps call times, venue details and last-minute changes attached to the job itself, not a thread that gets harder to search every week.",
      },
    ],
    relevantFeatures: [
      "staff-scheduling",
      "haccp-food-safety",
      "time-tracking-payroll",
      "training-certifications",
    ],
    relevantTemplates: [
      "reheat-hot-holding-record",
      "weekly-staff-rota",
      "staff-availability-form",
      "fridge-freezer-temperature-log",
    ],
    bestFor:
      "Catering companies and event caterers staffing jobs from a pool of casual and part-time staff, where crew lists change job to job rather than following a fixed weekly rota.",
    faq: [
      {
        q: "Can staff set which days or jobs they're available for?",
        a: "Yes — the availability feature lets staff declare when they can work, so you build a job's crew from people who are actually free instead of guessing or ringing round.",
      },
      {
        q: "Does the HACCP module cover food held or transported off-site?",
        a: "The reheat and hot-holding template covers temperature checks for food that's reheated or held before service away from a fixed kitchen — the same principle as a restaurant's pass, applied to a job that travels.",
      },
      {
        q: "Can I use this for a mix of regular and one-off casual staff?",
        a: "Yes. Regular staff can sit on a standing rota while casual staff are added job by job, with the same clock-in and payroll-hours process for both.",
      },
    ],
  },
];

export function getIndustry(slug: string) {
  return industries.find((i) => i.slug === slug);
}
