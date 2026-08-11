import { prisma } from "@/lib/prisma";

/**
 * Research one sourced venue well enough to decide what to do with it.
 *
 * WHY THIS IS A TRIAGE STEP AND NOT A PAGE GENERATOR
 * The first instinct was to have a model write an `about` paragraph for each of
 * the 4,241 sourced venues and publish. Testing that on real rows killed the
 * idea, and the numbers are the reason this file returns a verdict instead of
 * prose:
 *
 *  - "Paddy Mac's Pub, Tralee" returned citations for pubs of the same name in
 *    Verona and in Columbus, Ohio. Small Irish venues share names with venues
 *    worldwide, and a plausible paragraph about the wrong pub is worse than no
 *    page, because it is wrong in a way nobody on our side would notice.
 *  - "The Lough Avoul Inn" and "The Blasket" returned nothing but Tripadvisor
 *    and Yelp mirrors. There was no own-channel fact to be had, because a venue
 *    with no website usually has no web presence at all — which is exactly why
 *    our page can rank for it, and exactly why we cannot describe it.
 *  - "Copper Grove, Bandon" turned out to have its own website, coppergrove.ie,
 *    which OSM had not tagged. Building a page for it would have been effort
 *    spent on a venue whose own homepage will outrank us for its own name.
 *
 * So a research pass has three useful outcomes and one honest failure: it finds
 * an own website (retire the row to the ordinary pitch sequence), finds an own
 * social page (a real source a page can later be built from), finds a phone on
 * an own channel (worth keeping), or finds nothing (leave the row alone rather
 * than invent).
 *
 * WHY THE VERDICT IS STORED WITH ITS CITATIONS
 * Every claim this file records has to be auditable later, because the failure
 * mode is silent: a page describing the wrong venue looks completely normal.
 * Citations are written into `notes` so a human can check where a fact came
 * from without re-running the query.
 *
 * WHY NOTHING HERE PUBLISHES
 * A page still needs a street address and a description a person would read.
 * This file can supply the second only when a venue's own channel supplied it,
 * and the measured rate at which that happens is low. Publishing on anything
 * weaker is thin doorway content at scale, on the one domain we have.
 */

export type ResearchVerdict = {
  /** Own website, if the venue actually has one — retires the row. */
  ownWebsite: string | null;
  /** Own Facebook URL or handle, when it is genuinely theirs. */
  ownFacebook: string | null;
  ownInstagram: string | null;
  /** Only when printed on a channel the venue controls. */
  ownPhone: string | null;
  /**
   * Description built strictly from own-channel wording. Null is the expected
   * answer for most rows and must never be padded to clear a length check.
   */
  ownDescription: string | null;
  /** True when the sources found describe a different venue of the same name. */
  nameCollision: boolean;
  /** Raw model text, kept for auditing. */
  raw: string;
  citations: string[];
};

const SYSTEM = `You research small hospitality venues for a directory.

RULES, in order of importance:
1. Report a fact ONLY if it appears on a channel the venue itself controls: its
   own website, its own Facebook page, or its own Instagram. Directory copies
   (Tripadvisor, Yelp, Google Maps mirrors, evendo, pubsaroundme, wheree,
   whatsonpubs) are NOT the venue's own channel.
2. If a fact is only on a directory, return null for it. Do not repeat it.
3. Venue names repeat across countries. If the sources you find are for a venue
   of the same name in a DIFFERENT town or country from the address given, set
   name_collision true and return null for everything else.
4. Never write atmosphere, praise or filler. No "cosy", "warm welcome",
   "hidden gem", "nestled". A description must be plain fact: what kind of place
   it is, where it is, what it serves, only if its own channel says so.
5. Returning nulls is the correct and expected answer. It is much better than a
   guess.

Reply with JSON only, no prose, no code fence:
{"own_website":null,"own_facebook":null,"own_instagram":null,"own_phone":null,
 "own_description":null,"name_collision":false,"reasoning":"one short line"}`;

function firstJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || /^(null|none|unknown|unverified|n\/a)$/i.test(t)) return null;
  return t;
}

/**
 * Reject a description that is really a refusal or a directory paraphrase.
 *
 * The model complies with the "own channels only" rule but still likes to
 * narrate its compliance ("UNVERIFIED on the venue's own channels..."), and
 * that string would otherwise sail through a length check and land on a page.
 */
function usableDescription(v: string | null): string | null {
  if (!v) return null;
  if (/unverified|could not (verify|confirm)|no information|not provided|directory/i.test(v)) return null;
  if (/\b(cosy|cozy|hidden gem|nestled|warm welcome|charming|vibrant atmosphere)\b/i.test(v)) return null;
  if (v.length < 80) return null;
  return v;
}

export async function researchVenue(input: {
  name: string;
  street?: string | null;
  city?: string | null;
  postcode?: string | null;
  country: string;
  facebook?: string | null;
}): Promise<ResearchVerdict | { error: string }> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return { error: "PERPLEXITY_API_KEY not set" };

  const where = [input.street, input.city, input.postcode]
    .filter(Boolean)
    .join(", ");
  const country = input.country === "uk" ? "United Kingdom" : "Ireland";
  const fbHint = input.facebook ? `\nKnown Facebook handle: ${input.facebook}` : "";

  const question = `Venue: "${input.name}"
Address: ${where}, ${country}${fbHint}

Find whether this exact venue at this exact address has its own website, own
Facebook or own Instagram, and whether its own channels state a phone number or
a description of what it is. Remember: a venue of the same name elsewhere is a
name collision, not this venue.`;

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: question },
        ],
        temperature: 0,
        max_tokens: 600,
      }),
      cache: "no-store",
    });

    if (!res.ok) return { error: `perplexity ${res.status}: ${(await res.text()).slice(0, 200)}` };

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      citations?: string[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const parsed = firstJsonObject(raw);
    if (!parsed) return { error: "model did not return JSON" };

    return {
      ownWebsite: str(parsed.own_website),
      ownFacebook: str(parsed.own_facebook),
      ownInstagram: str(parsed.own_instagram),
      ownPhone: str(parsed.own_phone),
      ownDescription: usableDescription(str(parsed.own_description)),
      nameCollision: parsed.name_collision === true,
      raw,
      citations: json.citations ?? [],
    };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export type ResearchOutcome = {
  name: string;
  city: string | null;
  result: "has_own_site" | "buildable" | "social_only" | "nothing" | "collision" | "error";
  detail?: string;
};

/**
 * Research a batch and record what was learned. Publishes nothing.
 *
 * A row that turns out to have its own website is moved to `rejected`, not
 * deleted: it is still a perfectly good sales lead, it is just not a candidate
 * for a page that could outrank its owner.
 */
export async function researchBatch(
  limit: number,
  opts: { dry?: boolean; country?: string } = {}
): Promise<{ outcomes: ResearchOutcome[]; counts: Record<string, number> }> {
  const rows = await prisma.venueCandidate.findMany({
    where: {
      status: "new",
      hasWebsite: null,
      ...(opts.country ? { country: opts.country } : {}),
    },
    // Best-evidenced rows first: a phone or a social handle already on file
    // makes a real verdict far likelier than a bare name and street.
    orderBy: [{ phone: "desc" }, { facebook: "desc" }, { createdAt: "asc" }],
    take: limit,
  });

  const outcomes: ResearchOutcome[] = [];
  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);

  for (const row of rows) {
    const verdict = await researchVenue(row);

    if ("error" in verdict) {
      outcomes.push({ name: row.name, city: row.city, result: "error", detail: verdict.error });
      bump("error");
      continue;
    }

    const stamp = `[research ${new Date().toISOString().slice(0, 10)}] ${verdict.raw.slice(0, 400)}${
      verdict.citations.length ? `\nsources: ${verdict.citations.slice(0, 5).join(" ")}` : ""
    }`;

    let result: ResearchOutcome["result"];
    let data: Record<string, unknown> = {};

    if (verdict.nameCollision) {
      result = "collision";
      data = { status: "skipped", skipReason: "name collision — sources describe a different venue" };
    } else if (verdict.ownWebsite) {
      result = "has_own_site";
      data = {
        hasWebsite: true,
        websiteFound: verdict.ownWebsite,
        status: "rejected",
        skipReason: "has its own website — belongs in the pitch sequence, not a page",
      };
    } else if (verdict.ownDescription) {
      result = "buildable";
      data = {
        hasWebsite: false,
        status: "enriched",
        phone: verdict.ownPhone ?? row.phone ?? undefined,
        facebook: verdict.ownFacebook ?? row.facebook ?? undefined,
        instagram: verdict.ownInstagram ?? row.instagram ?? undefined,
      };
    } else if (verdict.ownFacebook || verdict.ownInstagram || verdict.ownPhone) {
      result = "social_only";
      data = {
        hasWebsite: false,
        phone: verdict.ownPhone ?? row.phone ?? undefined,
        facebook: verdict.ownFacebook ?? row.facebook ?? undefined,
        instagram: verdict.ownInstagram ?? row.instagram ?? undefined,
      };
    } else {
      result = "nothing";
      data = { hasWebsite: false };
    }

    outcomes.push({
      name: row.name,
      city: row.city,
      result,
      detail: verdict.ownWebsite ?? verdict.ownDescription?.slice(0, 90) ?? undefined,
    });
    bump(result);

    if (!opts.dry) {
      await prisma.venueCandidate.update({
        where: { id: row.id },
        data: {
          ...data,
          notes: row.notes ? `${row.notes}\n${stamp}` : stamp,
        },
      });
    }

    // Paid API, and the point of a sample is to learn, not to spend.
    await new Promise((r) => setTimeout(r, 1200));
  }

  return { outcomes, counts };
}
