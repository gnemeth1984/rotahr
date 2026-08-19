// Fill in the thin prospect pages at /v/<slug> from each venue's OWN website.
//
// WHY THIS EXISTS
// An audit of the 158 live public pages found 88 with no opening hours and 156
// with no menu. Google's scaled-content policy treats a large set of thin,
// near-identical generated pages as spam, and the risk lands on the whole
// rotahr.com domain — including the pages that sell the product. So the pages
// either earn their place or they should not be indexed.
//
// THE RULE THAT MATTERS
// These pages carry real businesses' names. A fabricated opening time is worse
// than a blank field — it sends a diner to a closed door and it publishes a
// falsehood about a business that never asked for the page. So:
//   * Only ever record what the venue's own site actually states.
//   * Every field carries provenance: which URL it came from, and when.
//   * The model is told to return null rather than guess, and anything it
//     returns that is not corroborated by the fetched text is dropped.
//   * OSM is a gap-filler only, never an override, and always flagged.
//
// This module does the extraction. It does NOT publish — a human approves.

import OpenAI from "openai";
import { fetchPage, htmlToText, parseOsmHours } from "@/lib/ai/venue-extract";
import type { OpeningHoursEntry } from "./types";

const MODEL = "gpt-4o-mini";

/** Where a value came from, so nothing is published as fact without a source. */
export interface Provenance {
  /** The exact URL the value was read from. */
  sourceUrl: string;
  fetchedAt: string;
  /** True when a human still needs to eyeball it before it goes live. */
  needsReview: boolean;
}

export interface EnrichedDish {
  name: string;
  description: string | null;
  /** Major units (euro), not cents. Null when the site lists no price. */
  price: number | null;
  category: "starter" | "main" | "dessert" | "sides" | "drinks" | "other";
}

export interface EnrichmentResult {
  slug: string;
  ok: boolean;
  /** Null when the site states no hours — NOT an empty week. */
  openingHours: OpeningHoursEntry[] | null;
  dishes: EnrichedDish[];
  about: string | null;
  cuisine: string | null;
  /** Pages actually fetched, in the order tried. */
  pagesFetched: string[];
  provenance: Record<string, Provenance>;
  /** Human-readable reasons a reviewer should look closer. */
  warnings: string[];
  error?: string;
}

/**
 * Paths worth trying beyond the homepage. Hours usually live on a contact page
 * and menus on a menu page; neither is reliably on the front page.
 */
const CANDIDATE_PATHS = [
  "",
  "/menu",
  "/menus",
  "/food",
  "/our-menu",
  "/opening-hours",
  "/contact",
  "/contact-us",
  "/about",
];

/**
 * Retail path fragments. A live test against a real venue's site pulled
 * "Forge Face/Neck Snood" (17) and "Forge Hat" (24) out of its online store and
 * offered them as dishes. Plenty of hospitality sites bolt a shop onto the same
 * domain, and the model cannot always tell a menu from a product grid, so the
 * shop is excluded from the crawl and from dish extraction.
 */
const MERCH_URL =
  /\/(shop|shops|store|stores|product|products|collections|merch|merchandise|gift|gifts|gift-?cards?|gift-?vouchers?|vouchers?|hampers?|basket|cart|checkout|subscri)/i;

function sameOrigin(base: string, path: string): string | null {
  try {
    const u = new URL(path, base);
    if (new URL(base).hostname !== u.hostname) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Discover the real menu/contact URLs by reading the site's own nav, instead of
 * only guessing paths. Guessed paths miss things like /the-food or /eat.
 */
export function linksFromHtml(html: string, base: string): string[] {
  const out = new Set<string>();
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    const label = htmlToText(m[2]).toLowerCase();
    if (!/menu|food|drink|hour|contact|about|open|book|eat|lunch|dinner|breakfast/.test(label + " " + href.toLowerCase())) {
      continue;
    }
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    // A "shop" link leads to product listings — nothing there belongs on a
    // venue's food page.
    if (MERCH_URL.test(href)) continue;
    // Skip obvious downloads the text extractor cannot read.
    if (/\.(jpg|jpeg|png|gif|webp|zip|doc|docx)$/i.test(href)) continue;
    const abs = sameOrigin(base, href);
    if (abs) out.add(abs.split("#")[0]);
  }
  return [...out];
}

const SYSTEM = `You read the text of a hospitality venue's OWN website and report only what it actually says.

You are building a public page that will appear on the open web under this venue's real name. A wrong opening time sends a customer to a closed door. Therefore:

ABSOLUTE RULES
- Never guess, infer, average, or "fill in" a value. If the text does not state it, return null.
- Do not use general knowledge about the venue or about typical hospitality hours. Only the supplied text.
- If the text shows hours for only some days, return only those days. Never complete the week.
- A day the site explicitly says is closed => {"closed": true}. A day not mentioned at all => omit it entirely.
- Times must be 24-hour "HH:MM". Convert "5pm" -> "17:00", "12 noon" -> "12:00".
- Ignore hours that clearly belong to something other than the venue's main trading: kitchen-only times are fine to report as trading hours ONLY if no separate venue hours are given, and then flag it.
- For dishes: only real, currently-listed FOOD AND DRINK items served to a customer at the venue. Never invent a price. Skip section headers, allergen notes and marketing lines.
- NEVER report an online-shop or gift-shop product as a dish. Not dishes: clothing and merchandise (hats, caps, snoods, t-shirts, hoodies, aprons, tote bags), homeware (mugs, tumblers, keep cups, flasks, tea towels, candles), gift cards, gift vouchers, hampers, cookbooks, subscriptions, and retail packages sold to take home (a 250g/1kg bag of coffee beans, a box of teabags, a jar of jam). If the surrounding text is a product listing with an "add to cart", a stock status, a weight or a grind option, it is retail, not a menu.
- If the page is a cookie wall, a holding page, or has no usable content, say so via "unusable": true.

OUTPUT JSON ONLY:
{
  "unusable": boolean,
  "openingHours": null | [{"day": 0-6 (0=Sunday), "closed": boolean, "open": "HH:MM", "close": "HH:MM"}],
  "hoursQuote": null | "the exact sentence(s) from the text stating the hours",
  "dishes": [{"name": string, "description": string|null, "price": number|null, "category": "starter"|"main"|"dessert"|"sides"|"drinks"|"other"}],
  "about": null | "1-3 factual sentences drawn ONLY from the text",
  "cuisine": null | "short label e.g. Modern Irish, Thai, Seafood",
  "flags": [ "anything a human reviewer should double-check" ]
}`;

interface ModelOut {
  unusable?: boolean;
  openingHours?: { day: number; closed?: boolean; open?: string; close?: string }[] | null;
  hoursQuote?: string | null;
  dishes?: { name?: string; description?: string | null; price?: number | null; category?: string }[];
  about?: string | null;
  cuisine?: string | null;
  flags?: string[];
}

const CATEGORIES = new Set(["starter", "main", "dessert", "sides", "drinks", "other"]);

/** Keep only well-formed, non-invented hour entries. */
function sanitiseHours(
  raw: ModelOut["openingHours"]
): OpeningHoursEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  // Keyed by day AND times: a venue that serves lunch and then dinner has two
  // sessions on the same day, and collapsing them would claim it is open through
  // the afternoon break.
  const seen = new Set<string>();
  const sessions: OpeningHoursEntry[] = [];
  const closedDays = new Set<number>();

  for (const h of raw) {
    const day = Number(h?.day);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    if (h?.closed) {
      closedDays.add(day);
      continue;
    }
    const open = typeof h?.open === "string" && /^\d{2}:\d{2}$/.test(h.open) ? h.open : null;
    const close = typeof h?.close === "string" && /^\d{2}:\d{2}$/.test(h.close) ? h.close : null;
    if (!open || !close) continue;
    const key = `${day}|${open}|${close}`;
    if (seen.has(key)) continue;
    seen.add(key);
    closedDays.delete(day);
    if (sessions.filter((x) => x.day === day).length >= 3) continue;
    sessions.push({ day, closed: false, open, close });
  }

  if (sessions.length === 0) return null;
  for (const day of closedDays) {
    if (!sessions.some((x) => x.day === day)) {
      sessions.push({ day, closed: true, open: "", close: "" });
    }
  }
  return sessions.sort((a, b) => a.day - b.day || a.open.localeCompare(b.open));
}

/**
 * Corroborate the model's hours against the fetched text.
 *
 * The model is instructed not to invent, but instruction is not a guarantee, so
 * we verify: the quote it cites must actually appear in the source text, and the
 * times it reports must be findable there. This is the check that stops a
 * repeat of the fabricated-hours bug.
 */
export function hoursAreCorroborated(
  hours: OpeningHoursEntry[],
  quote: string | null | undefined,
  sourceText: string
): { ok: boolean; reason?: string; warning?: string } {
  const hay = sourceText.toLowerCase().replace(/\s+/g, " ");
  let warning: string | undefined;

  // The quote is a supporting signal, not the guarantee. Matching it literally
  // rejected genuine hours on two of five test venues, because the model tidies
  // punctuation while the page ships things like "12.30 pm &#8211; 15.00 pm".
  // So compare on words alone, and when it still cannot be located, flag it for
  // the reviewer instead of throwing away real data. The check that actually
  // prevents fabrication is the time-by-time one below, which is unchanged.
  if (quote && quote.trim().length > 8) {
    if (!quoteIsPresent(quote, sourceText)) {
      warning = "the quoted hours sentence could not be located in the page text";
    }
  }

  // Every distinct opening time should be traceable to the page, allowing for
  // "17:00", "17.00", "5pm", "5 pm", "5:00pm".
  const times = new Set<string>();
  for (const h of hours) {
    if (h.closed) continue;
    times.add(h.open);
    times.add(h.close);
  }
  let missing = 0;
  for (const t of times) {
    const [hhStr, mm] = t.split(":");
    const hh = Number(hhStr);
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    const suffix = hh < 12 ? "am" : "pm";
    const variants = [
      `${hhStr}:${mm}`,
      `${hh}:${mm}`,
      `${hhStr}.${mm}`,
      `${hh}.${mm}`,
      mm === "00" ? `${h12}${suffix}` : null,
      mm === "00" ? `${h12} ${suffix}` : null,
      `${h12}:${mm}${suffix}`,
      `${h12}:${mm} ${suffix}`,
      `${h12}.${mm}${suffix}`,
      mm === "00" && hh === 12 ? "noon" : null,
      mm === "00" && hh === 0 ? "midnight" : null,
    ].filter(Boolean) as string[];
    if (!variants.some((v) => hay.includes(v))) missing++;
  }
  if (missing > 0) {
    return { ok: false, reason: `${missing} reported time(s) do not appear in the page text` };
  }
  return warning ? { ok: true, warning } : { ok: true };
}

/** True when this URL is a retail page rather than a menu. */
export function isRetailPage(url: string): boolean {
  try {
    return MERCH_URL.test(new URL(url).pathname);
  } catch {
    return MERCH_URL.test(url);
  }
}

/** Physical goods a venue sells but does not serve at a table. */
const MERCH_WORDS = [
  "snood", "hat", "cap", "beanie", "t-shirt", "tshirt", "t shirt", "tee shirt",
  "hoodie", "hoody", "sweatshirt", "jumper", "apron", "tote", "sock", "socks",
  "glove", "gloves", "scarf", "umbrella", "keyring", "key ring", "sticker",
  "poster", "print", "magnet", "badge", "mug", "tumbler", "keep cup", "keepcup",
  "flask", "water bottle", "bottle opener", "corkscrew", "tea towel", "coaster",
  "candle", "soap", "cookbook", "recipe book", "gift card", "gift voucher",
  "gift set", "gift box", "hamper", "merch", "merchandise", "e-voucher",
  "subscription", "wholesale", "beer glass", "pint glass", "wine glass",
];

/** Retail packaging and shop-page furniture. */
const RETAIL_SIGNALS = [
  "whole bean", "wholebean", "ground coffee", "coffee beans", "bean bag",
  "add to cart", "add to basket", "in stock", "out of stock", "sold out",
  "free delivery", "free shipping", "grind option", "choose your grind",
  "select options", "per bag", "retail pack", "take home pack", "6 pack",
  "12 pack", "case of", "gift wrapped",
];

/**
 * A weight is packaging. Volumes are deliberately excluded: "Cold Brew 500ml"
 * and a 330ml can of beer are real menu items.
 */
const WEIGHT = /\b\d{2,4}\s?(g|gr|gram|grams|kg)\b/i;
/** Something served in a cup costs a few euro; a bag of it does not. */
const TAKE_HOME_DRINK = /\b(coffee|espresso|beans?|teabags?|cocoa|single origin)\b/i;
/**
 * Served-at-the-table exceptions to the price test. "Afternoon Tea" runs to 40
 * a head and an Irish coffee can pass 10, so neither may be mistaken for retail.
 */
const REAL_DRINK_UNIT =
  /\b(bottle|wine|carafe|magnum|jug|pitcher|cocktail|pint|glass of|irish coffee|martini|affogato|liqueur|afternoon tea|high tea|cream tea)\b/i;

/**
 * Reject shop products masquerading as menu items. Erring towards dropping a
 * borderline item is the right trade: a missing dish is a gap, a snood on a food
 * menu is a public embarrassment published under someone else's business name.
 */
export function isRetailItem(d: EnrichedDish): boolean {
  const name = d.name.toLowerCase().replace(/\s+/g, " ").trim();
  const blob = `${name} ${(d.description ?? "").toLowerCase()}`;

  for (const w of MERCH_WORDS) {
    // Word-ish boundaries so "hat" does not match "hatch", "cap" not "caprese".
    const re = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z])`, "i");
    if (re.test(name)) return true;
  }
  for (const sig of RETAIL_SIGNALS) {
    if (blob.includes(sig)) return true;
  }
  // A weight in the name is packaging, not a plate.
  if (WEIGHT.test(name)) return true;
  // A 18 euro "coffee" is a bag to take home, not a cup.
  if (
    d.price !== null &&
    d.price >= 10 &&
    TAKE_HOME_DRINK.test(name) &&
    !REAL_DRINK_UNIT.test(name)
  ) {
    return true;
  }
  return false;
}

const DAY_WORDS = [
  ["sunday", "sun"],
  ["monday", "mon"],
  ["tuesday", "tue", "tues"],
  ["wednesday", "wed", "weds"],
  ["thursday", "thu", "thur", "thurs"],
  ["friday", "fri"],
  ["saturday", "sat"],
];

/**
 * Is this day really stated as closed?
 *
 * A test venue's site said "Sunday: 13.00 pm - 22.00 pm" and the model reported
 * Sunday closed. The time-by-time check cannot catch that, because a closed day
 * carries no times — yet "Closed" on a day the venue actually trades is the worst
 * failure this pipeline can produce: it turns customers away from someone else's
 * business. So a closed day is only kept when the word appears beside that day's
 * name in the page text; otherwise the day is left blank.
 */
export function closedIsCorroborated(day: number, sourceText: string): boolean {
  const hay = sourceText.toLowerCase().replace(/\s+/g, " ");
  // "closed all day monday", "monday: closed", "mon - closed", "closed sunday"
  for (const w of DAY_WORDS[day] ?? []) {
    const re = new RegExp(
      `(closed[^.;|]{0,30}\\b${w}\\b)|(\\b${w}\\b[^.;|]{0,30}closed)`,
      "i"
    );
    if (re.test(hay)) return true;
  }
  return false;
}

/** Letters, digits and colons only, so punctuation and entities cannot cause a miss. */
function words(x: string): string[] {
  return x
    .toLowerCase()
    .replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, " ")
    .replace(/[^a-z0-9:.]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Is the model's quote really on the page? Substring first, then a word-overlap
 * fallback: a quote is present when most of its distinctive words are.
 */
function quoteIsPresent(quote: string, sourceText: string): boolean {
  const hayWords = words(sourceText);
  const hay = ` ${hayWords.join(" ")} `;
  const q = words(quote);
  if (q.length === 0) return false;

  const needle = q.slice(0, 10).join(" ");
  if (hay.includes(` ${needle} `)) return true;

  const bag = new Set(hayWords);
  const hits = q.filter((w) => bag.has(w)).length;
  return hits / q.length >= 0.7;
}

/** Dishes must be traceable to the page text too. */
function corroborateDishes(dishes: EnrichedDish[], sourceText: string): EnrichedDish[] {
  const hay = sourceText.toLowerCase().replace(/\s+/g, " ");
  return dishes.filter((d) => {
    const n = d.name.toLowerCase().replace(/\s+/g, " ").trim();
    return n.length > 2 && hay.includes(n);
  });
}

async function readOne(url: string, text: string): Promise<ModelOut | null> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const res = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `URL: ${url}\n\nPAGE TEXT:\n${text.slice(0, 18000)}` },
      ],
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw) as ModelOut;
  } catch (e) {
    console.error("[enrich] model call failed for", url, e);
    return null;
  }
}

/**
 * Enrich one venue from its own website.
 *
 * Returns what was found plus provenance. Publishes nothing.
 */
export async function enrichFromWebsite(opts: {
  slug: string;
  website: string;
  /** Raw OSM opening_hours string, used ONLY if the site yields nothing. */
  osmHours?: string | null;
}): Promise<EnrichmentResult> {
  const { slug, website } = opts;
  const result: EnrichmentResult = {
    slug,
    ok: false,
    openingHours: null,
    dishes: [],
    about: null,
    cuisine: null,
    pagesFetched: [],
    provenance: {},
    warnings: [],
  };

  let base: string;
  try {
    base = new URL(website).toString();
  } catch {
    result.error = `unparseable website url: ${website}`;
    return result;
  }

  // 1. Homepage, to discover the real nav links.
  const home = await fetchPage(base);
  if (!home.ok) {
    result.error = "homepage did not respond";
    return result;
  }
  result.pagesFetched.push(base);

  const discovered = home.html ? linksFromHtml(home.html, base) : [];
  const guessed = CANDIDATE_PATHS.map((p) => sameOrigin(base, p)).filter(Boolean) as string[];
  // Discovered links first — they are real. Cap the crawl so one venue cannot
  // burn the whole budget.
  const queue = [...new Set([...discovered, ...guessed])]
    .filter((u) => u !== base)
    .slice(0, 6);

  const texts: { url: string; text: string }[] = [{ url: base, text: home.text }];
  for (const url of queue) {
    const page = await fetchPage(url);
    if (!page.ok || page.text.length < 200) continue;
    result.pagesFetched.push(url);
    texts.push({ url, text: page.text });
  }

  const now = new Date().toISOString();

  // 2. Read each page, keeping the first well-corroborated answer per field.
  for (const { url, text } of texts) {
    const out = await readOne(url, text);
    if (!out || out.unusable) continue;
    if (Array.isArray(out.flags)) {
      for (const f of out.flags) {
        if (typeof f === "string" && f.trim()) result.warnings.push(`${url}: ${f.trim()}`);
      }
    }

    if (!result.openingHours) {
      let hours = sanitiseHours(out.openingHours);
      if (hours) {
        const check = hoursAreCorroborated(hours, out.hoursQuote, text);
        if (check.ok) {
          const closedDropped = hours
            .filter((h) => h.closed && !closedIsCorroborated(h.day, text))
            .map((h) => DAY_WORDS[h.day][0]);
          const verified = hours.filter(
            (h) => !h.closed || closedIsCorroborated(h.day, text)
          );
          if (closedDropped.length) {
            result.warnings.push(
              `${url}: dropped "closed" for ${closedDropped.join(", ")} — the page does not say so, so ${
                closedDropped.length > 1 ? "those days are" : "that day is"
              } left blank`
            );
          }
          hours = verified;
          result.openingHours = hours;
          result.provenance.openingHours = { sourceUrl: url, fetchedAt: now, needsReview: true };
          if (check.warning) result.warnings.push(`${url}: ${check.warning}`);
          const days = new Set(hours.map((h) => h.day)).size;
          if (days < 7) {
            result.warnings.push(
              `${url}: only ${days} of 7 days stated — the rest are deliberately blank`
            );
          }
          if (hours.length > days) {
            result.warnings.push(
              `${url}: split service detected (more than one session on some days) — check the sessions read correctly`
            );
          }
        } else {
          result.warnings.push(`${url}: rejected hours — ${check.reason}`);
        }
      }
    }

    if (
      result.dishes.length === 0 &&
      !isRetailPage(url) &&
      Array.isArray(out.dishes) &&
      out.dishes.length
    ) {
      const cleaned: EnrichedDish[] = out.dishes
        .map((d) => ({
          name: String(d?.name ?? "").trim(),
          description: d?.description?.toString().trim() || null,
          price:
            typeof d?.price === "number" && Number.isFinite(d.price) && d.price > 0
              ? Math.round(d.price * 100) / 100
              : null,
          category: (CATEGORIES.has(String(d?.category)) ? String(d?.category) : "other") as EnrichedDish["category"],
        }))
        .filter((d) => d.name.length > 2 && d.name.length < 120);

      const food = cleaned.filter((d) => !isRetailItem(d));
      if (food.length < cleaned.length) {
        result.warnings.push(
          `${url}: dropped ${cleaned.length - food.length} shop product(s) offered as dishes`
        );
      }

      const corroborated = corroborateDishes(food, text);
      if (corroborated.length < food.length) {
        result.warnings.push(
          `${url}: dropped ${food.length - corroborated.length} dish(es) not found in the page text`
        );
      }
      if (corroborated.length) {
        result.dishes = corroborated.slice(0, 60);
        result.provenance.dishes = { sourceUrl: url, fetchedAt: now, needsReview: true };
      }
    }

    if (!result.about && out.about && out.about.trim().length > 40) {
      result.about = out.about.trim().slice(0, 600);
      result.provenance.about = { sourceUrl: url, fetchedAt: now, needsReview: true };
    }

    if (!result.cuisine && out.cuisine && out.cuisine.trim().length > 2) {
      result.cuisine = out.cuisine.trim().slice(0, 60);
      result.provenance.cuisine = { sourceUrl: url, fetchedAt: now, needsReview: true };
    }
  }

  // 3. OSM only as a last resort for hours, always flagged — a name match can
  //    easily be the wrong branch of a chain.
  if (!result.openingHours && opts.osmHours) {
    const parsed = parseOsmHours(opts.osmHours);
    if (parsed?.some((h) => !h.closed)) {
      result.openingHours = parsed;
      result.provenance.openingHours = {
        sourceUrl: "https://www.openstreetmap.org",
        fetchedAt: now,
        needsReview: true,
      };
      result.warnings.push(
        "hours came from OpenStreetMap, not the venue's own site — verify before publishing"
      );
    }
  }

  result.ok = Boolean(
    result.openingHours || result.dishes.length || result.about || result.cuisine
  );
  if (!result.ok) result.error = "nothing usable found on the site";
  return result;
}
