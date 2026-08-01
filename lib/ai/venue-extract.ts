// Turn a public URL (Google Maps listing, Facebook page, venue website) into a
// draft public-page record for Gabor to review.
//
// Rule that matters: this only ever reports what it actually found on the page.
// These pages go live on rotahr.com under a real business's name, so an invented
// phone number or made-up opening hours is worse than a blank field.

import OpenAI from "openai";
import type { OpeningHoursEntry } from "@/lib/public-page/types";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export interface ExtractedVenue {
  name: string | null;
  tagline: string | null;
  about: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  venueType: string | null;
  cuisine: string | null;
  geoLat: number | null;
  geoLng: number | null;
  openingHours: OpeningHoursEntry[] | null;
  notesForReview: string[];
}

const EMPTY: ExtractedVenue = {
  name: null,
  tagline: null,
  about: null,
  address: null,
  phone: null,
  email: null,
  website: null,
  facebook: null,
  instagram: null,
  venueType: null,
  cuisine: null,
  geoLat: null,
  geoLng: null,
  openingHours: null,
  notesForReview: [],
};

/** Strip a fetched HTML document down to readable text the model can work with. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull lat/lng straight out of a Google Maps URL when it's in there. */
export function coordsFromUrl(url: string): { lat: number; lng: number } | null {
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  const q = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) return { lat: Number(q[1]), lng: Number(q[2]) };
  return null;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      // Plain browser UA — Facebook and Maps serve nothing useful to an unknown client.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      "Accept-Language": "en-IE,en;q=0.9",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Could not load that page (HTTP ${res.status}).`);
  const html = await res.text();
  return htmlToText(html).slice(0, 30000);
}

const SYSTEM = `
You extract factual business details for a hospitality venue directory page.

CRITICAL RULES:
- Only report details that literally appear in the supplied page text. Never guess, never infer, never fill a plausible-looking value. A null is always better than a wrong fact — these pages are published publicly under the real business's name.
- Do not invent opening hours. If hours are not clearly stated, return null.
- Do not invent a phone number, email or address. Copy them exactly as written.
- "about" must be 1-3 sentences of plain description built ONLY from facts on the page (what kind of venue it is, where it is, what it is known for). No marketing adjectives you cannot support, no claims about food quality, no prices, no menu items unless they are explicitly listed on the page.
- "tagline" is one short line, max 90 characters, also fact-based.
- venueType must be one of: restaurant, cafe, bar, pub, hotel, other.
- openingHours: array of { day, closed, open, close } where day 0=Sunday..6=Saturday, times "HH:mm" 24-hour. Include all 7 days if you can determine them; if you can only determine some, include only those.
- notesForReview: short strings flagging anything ambiguous, contradictory or worth a human check (e.g. "Sunday hours were written as '12.30am to 11pm' — read as 12:30pm", "page may belong to a different branch").

Return ONLY JSON matching the requested shape.
`.trim();

export async function extractVenueFromUrl(url: string): Promise<ExtractedVenue> {
  const text = await fetchPage(url);

  if (text.length < 200) {
    return {
      ...EMPTY,
      notesForReview: [
        "That page returned almost no readable text — it is probably rendered by JavaScript or behind a login. Fill the details in by hand, or paste a different URL (the venue's own website usually works best).",
      ],
    };
  }

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Source URL: ${url}\n\nPage text:\n${text}\n\nReturn JSON with keys: name, tagline, about, address, phone, email, website, facebook, instagram, venueType, cuisine, geoLat, geoLng, openingHours, notesForReview. Use null for anything not stated on the page.`,
      },
    ],
  });

  let parsed: Partial<ExtractedVenue> = {};
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
  } catch {
    return { ...EMPTY, notesForReview: ["Could not read the AI response — try again or fill it in by hand."] };
  }

  const coords = coordsFromUrl(url);
  const hours = Array.isArray(parsed.openingHours) ? parsed.openingHours : null;

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  const result: ExtractedVenue = {
    name: str(parsed.name),
    tagline: str(parsed.tagline),
    about: str(parsed.about),
    address: str(parsed.address),
    phone: str(parsed.phone),
    email: str(parsed.email),
    website: str(parsed.website),
    facebook: str(parsed.facebook) ?? (url.includes("facebook.com") ? url : null),
    instagram: str(parsed.instagram),
    venueType: str(parsed.venueType),
    cuisine: str(parsed.cuisine),
    geoLat: num(parsed.geoLat) ?? coords?.lat ?? null,
    geoLng: num(parsed.geoLng) ?? coords?.lng ?? null,
    openingHours: hours as OpeningHoursEntry[] | null,
    notesForReview: Array.isArray(parsed.notesForReview)
      ? parsed.notesForReview.filter((n): n is string => typeof n === "string").slice(0, 6)
      : [],
  };

  if (!result.openingHours?.length) {
    result.notesForReview.push("No opening hours found on that page — add them by hand or the page stays out of Google.");
  }
  if (!result.address) {
    result.notesForReview.push("No address found — needed before the page can be indexed.");
  }

  return result;
}
