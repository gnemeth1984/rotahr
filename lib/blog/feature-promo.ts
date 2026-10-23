/**
 * Pick the one Rotahr feature worth promoting under a blog article, plus the
 * short pitch shown for it.
 *
 * Keyword scoring, no model call: a wrong pick is a bad promo on a public page,
 * and a keyword match is auditable and testable. The title counts far more
 * than the body, because a temperature-log article that mentions rotas once is
 * still a HACCP article. The article's category adds a small nudge and is the
 * fallback when nothing matches, so every article gets exactly one feature.
 *
 * Pitch copy rules (checked by checkRotahrFacts in the test): flat pricing,
 * never per employee; first 3 months free; only claim what lib/seo/features.ts
 * says the module does.
 */

/** ActivityLog action for promo clicks (see app/api/blog/feature-click). */
export const BLOG_FEATURE_CLICK_ACTION = "blog_feature_click";

export const PROMO_FEATURE_SLUGS = [
  "staff-scheduling",
  "haccp-food-safety",
  "table-bookings",
  "time-tracking-payroll",
  "stock-recipe-costing",
  "bookkeeping-receipts",
  "guest-crm",
  "training-certifications",
  "equipment-register",
  "manager-copilot",
] as const;

export type PromoFeatureSlug = (typeof PROMO_FEATURE_SLUGS)[number];

export interface FeaturePitch {
  slug: PromoFeatureSlug;
  /** Short name shown as the eyebrow. */
  name: string;
  /** One line, reads as the answer to the article's problem. */
  headline: string;
  blurb: string;
  bullets: [string, string, string];
}

export const FEATURE_PITCHES: Record<PromoFeatureSlug, FeaturePitch> = {
  "staff-scheduling": {
    slug: "staff-scheduling",
    name: "Rota & scheduling",
    headline: "Build the week's rota on one screen and publish it to every phone",
    blurb:
      "Rotahr replaces the spreadsheet and the WhatsApp group: swaps, time off and last-minute cover all come to you as approvals, not messages.",
    bullets: [
      "Wage cost updates as you drag shifts, before you publish",
      "Approved time off and availability greyed out on the grid",
      "Alerts when someone hasn't clocked in for their shift",
    ],
  },
  "haccp-food-safety": {
    slug: "haccp-food-safety",
    name: "HACCP & food safety",
    headline: "Replace the paper food-safety diary with checks staff log on their phone",
    blurb:
      "Temperature checks, deliveries, cleaning checklists and corrective actions, all against your own named equipment — and exported as one PDF when an inspector walks in.",
    bullets: [
      "Cooking and cooling thresholds built in (75°C core for cooking)",
      "Due checks remind whoever is on shift, not the whole team",
      "One-tap inspection pack with names and timestamps",
    ],
  },
  "table-bookings": {
    slug: "table-bookings",
    name: "Bookings & floor plan",
    headline: "Take bookings on your real floor plan, not a list",
    blurb:
      "Guests book through your own public booking page, and every reservation lands on a drag-and-drop plan of your dining room, colour-coded for the night.",
    bullets: [
      "Click a free table to book it, click a taken one to see who's in",
      "No-shows recorded against the guest, so patterns show early",
      "Every booking builds a guest profile automatically",
    ],
  },
  "time-tracking-payroll": {
    slug: "time-tracking-payroll",
    name: "Clock-in & payroll",
    headline: "Staff clock in on their phone, and the hours are payroll-ready",
    blurb:
      "No hardware terminal, no paper timesheet. Breaks are tracked against the legal thresholds, and rostered and actual hours sit side by side.",
    bullets: [
      "Break reminders that fire even with the app closed",
      "Payroll summary per person, breaks deducted, ready to export",
      "Tips and tronc kept separate from wages",
    ],
  },
  "stock-recipe-costing": {
    slug: "stock-recipe-costing",
    name: "Stock & recipe costing",
    headline: "Recipe costs that update when a supplier puts prices up",
    blurb:
      "Rotahr costs every dish from the last price you actually paid, so gross margin per dish is always current without rebuilding a spreadsheet.",
    bullets: [
      "Supplier price history on every stock item",
      "Delivery-note photo updates stock, expenses and the HACCP check",
      "Margin Guard lists the dishes a price rise has hurt",
    ],
  },
  "bookkeeping-receipts": {
    slug: "bookkeeping-receipts",
    name: "Bookkeeping & receipts",
    headline: "Photograph a receipt and the expense files itself",
    blurb:
      "Rotahr reads the vendor, date, line items, total and tax, shows you an editable draft, and builds your P&L as expenses come in.",
    bullets: [
      "Weekly and monthly P&L plus a tax summary",
      "Labour cost broken down per person",
      "CSV export for your accountant",
    ],
  },
  "guest-crm": {
    slug: "guest-crm",
    name: "Guest CRM",
    headline: "A guest list that builds itself from your bookings",
    blurb:
      "Every reservation creates or updates a guest profile — visits, spend, no-shows, tags and notes — with loyalty tiers and points on top.",
    bullets: [
      "Segments like lapsed regulars, birthdays and VIPs",
      "Email only to guests who opted in",
      "Campaigns queue as drafts for a person to approve",
    ],
  },
  "training-certifications": {
    slug: "training-certifications",
    name: "Training & certifications",
    headline: "Staff training built from your own menu, equipment and rota",
    blurb:
      "Thirteen short in-house courses generated from your venue's data, with an 80% pass mark, a 12-month expiry and a printable record for each person. In-house training, not an accredited qualification.",
    bullets: [
      "Allergen awareness from your actual menu",
      "Assign with a due date; outstanding ones get chased",
      "One grid of every person against every course",
    ],
  },
  "equipment-register": {
    slug: "equipment-register",
    name: "Equipment & service register",
    headline: "Know what's due for a service before it breaks",
    blurb:
      "Every piece of equipment, who to ring, the warranty and the certificates in one register, with warnings 30 and 7 days before anything falls due.",
    bullets: [
      "Full service history with costs and engineers",
      "Warranty details, so nobody pays for a covered callout",
      "A Monday-morning digest of what's due this week",
    ],
  },
  "manager-copilot": {
    slug: "manager-copilot",
    name: "Manager Copilot",
    headline: "One morning brief instead of six screens",
    blurb:
      "The Copilot reads your own rota, bookings, HACCP logs, stock and supplier prices and lists what needs doing today. Included on every plan.",
    bullets: [
      "Missed or failed checks and expiring certificates",
      "Dishes a supplier price rise has hurt",
      "Covers coming in against the staff on the rota",
    ],
  },
};

/** Phrases that signal each feature. Matched on word boundaries, lowercase. */
const SIGNALS: Record<PromoFeatureSlug, string[]> = {
  "staff-scheduling": [
    "rota", "rotas", "roster", "rostering", "staff scheduling", "shift scheduling",
    "scheduling software", "schedule staff", "shift planning", "shift planner",
    "staff availability", "time off", "time-off", "holiday request", "shift swap",
    "swap shifts", "callout", "callouts", "call-out", "seasonal staff", "public holiday",
    "public holidays", "bank holiday", "predictive scheduling", "whatsapp", "group chat",
    "staff communication", "cross-training", "overtime", "zero-hour", "zero hour",
    "schedule", "scheduling", "shift", "shifts", "labour cost", "labor cost",
    "labour costs", "labor costs", "wage cost", "wage costs", "shift cost", "staffing",
  ],
  "haccp-food-safety": [
    "haccp", "food safety", "temperature log", "temperature logs", "temperature check",
    "temperature checks", "cleaning schedule", "cleaning checklist", "checklist app",
    "checklist apps", "opening and closing", "closing checklist", "opening checklist",
    "inspection", "inspector", "environmental health", "safetyculture", "food hygiene",
    "corrective action", "food safety records", "kitchen compliance", "due diligence",
    "fridge", "fridges",
  ],
  "table-bookings": [
    "table management", "reservation", "reservations", "booking system", "table booking",
    "table bookings", "booking app", "seating", "floor plan", "host stand", "hosting app",
    "table turnover", "covers", "walk-ins", "book a table", "booking", "bookings",
  ],
  "time-tracking-payroll": [
    "clock in", "clock-in", "clocking in", "clock out", "time clock", "timesheet",
    "timesheets", "payroll", "break entitlement", "break entitlements", "rest break",
    "tips", "tronc", "tip credit", "tip pooling", "minimum wage", "hours worked",
    "working time", "pay run", "payslip", "wages",
  ],
  "stock-recipe-costing": [
    "food cost", "food costs", "recipe costing", "recipe cost", "menu engineering",
    "menu pricing", "dish pricing", "gross margin", "gross profit", "stock", "stocktake",
    "inventory", "supplier price", "supplier prices", "food waste", "waste", "costing",
    "price dishes", "pricing dishes", "margin",
  ],
  "bookkeeping-receipts": [
    "receipt", "receipts", "bookkeeping", "accountant", "expenses", "expense",
    "profit and loss", "p&l", "vat", "invoices", "cash flow",
  ],
  "guest-crm": [
    "crm", "loyalty", "regulars", "marketing list", "email marketing", "repeat guests",
    "repeat customers", "customer database", "guest data", "guest profiles", "birthday",
  ],
  "training-certifications": [
    "training", "induction", "onboarding", "new starter", "new starters", "allergen training",
    "certification", "certifications", "certificate", "upskilling", "staff development",
  ],
  "equipment-register": [
    "equipment", "maintenance", "service contract", "warranty", "breakdown", "extraction",
    "gas safety", "pat testing", "engineer", "repairs",
  ],
  "manager-copilot": [
    "copilot", "morning brief", "daily brief", "manager burnout", "burnout",
    "multi-venue", "multi venue", "multiple venues", "multi-site", "restaurant technology",
    "ai assistant", "operations software", "one app", "all-in-one", "all in one",
  ],
};

/** Category nudge (+ fallback when nothing matches). Keys are BlogPost.category. */
const CATEGORY_FEATURE: Record<string, PromoFeatureSlug> = {
  scheduling: "staff-scheduling",
  compliance: "haccp-food-safety",
  hr: "staff-scheduling",
  finance: "stock-recipe-costing",
  costs: "stock-recipe-costing",
  payroll: "time-tracking-payroll",
  management: "table-bookings",
  technology: "manager-copilot",
  product: "staff-scheduling",
};

const TITLE_WEIGHT = 8;
const BODY_CAP = 6;
const CATEGORY_NUDGE = 3;

const regexCache = new Map<string, RegExp>();
function phraseRegex(p: string): RegExp {
  let r = regexCache.get(p);
  if (!r) {
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[\\s-]+");
    r = new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`, "g");
    regexCache.set(p, r);
  }
  r.lastIndex = 0;
  return r;
}

function count(text: string, phrase: string): number {
  return (text.match(phraseRegex(phrase)) || []).length;
}

export interface FeatureMatch {
  pitch: FeaturePitch;
  score: number;
  /** "match" when keywords picked it, "category" when it's the fallback. */
  via: "match" | "category";
  scores: Record<PromoFeatureSlug, number>;
}

export function suggestFeature(input: {
  title: string;
  excerpt?: string | null;
  content?: string | null;
  category?: string | null;
}): FeatureMatch {
  const title = input.title.toLowerCase();
  const body = `${input.excerpt ?? ""} ${input.content ?? ""}`.toLowerCase();
  const scores = {} as Record<PromoFeatureSlug, number>;
  for (const slug of PROMO_FEATURE_SLUGS) {
    let s = 0;
    for (const p of SIGNALS[slug]) {
      s += count(title, p) * TITLE_WEIGHT;
      s += Math.min(count(body, p), BODY_CAP);
    }
    scores[slug] = s;
  }
  const cat = CATEGORY_FEATURE[(input.category ?? "").toLowerCase()] ?? "staff-scheduling";
  const raw = { ...scores };
  scores[cat] += CATEGORY_NUDGE;

  let best: PromoFeatureSlug = cat;
  for (const slug of PROMO_FEATURE_SLUGS) if (scores[slug] > scores[best]) best = slug;
  // Below this, keywords didn't really pick anything; use the category.
  const via = raw[best] >= 4 ? "match" : "category";
  if (via === "category") best = cat;
  return { pitch: FEATURE_PITCHES[best], score: scores[best], via, scores };
}

/**
 * Split article markdown so the inline promo can sit between sections. Returns
 * [before, after]; `after` is empty when the article is too short to break up
 * (fewer than 4 H2 sections), in which case only the end-of-article card shows.
 */
export function splitForInlinePromo(markdown: string): [string, string] {
  const lines = markdown.split("\n");
  const h2: number[] = [];
  let inFence = false;
  lines.forEach((l, i) => {
    if (/^\s*```/.test(l)) inFence = !inFence;
    if (!inFence && /^##\s+\S/.test(l)) h2.push(i);
  });
  if (h2.length < 4) return [markdown, ""];
  const at = h2[Math.floor(h2.length / 2)];
  return [lines.slice(0, at).join("\n"), lines.slice(at).join("\n")];
}
