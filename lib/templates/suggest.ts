/**
 * Pick the templates worth linking from a piece of text (a blog article).
 *
 * The point is internal linking a reader actually wants: an article about
 * fridge temperatures should offer the temperature log, not three random
 * downloads. Scored on the template's own wording against the article — no
 * model call, because a wrong pick is a bad link on a public page and a keyword
 * match is auditable and testable.
 *
 * Two earlier versions are worth knowing about, because both looked fine and
 * were wrong when checked against the 80 live articles:
 *
 *   1. matching whole search phrases ("free fridge freezer temperature log
 *      template") hit 2 of 80 — nobody writes prose in search-phrase form.
 *   2. matching any keyword bigram made the HACCP corrective action log win 29
 *      of 80, because its keyword list contains "food safety", a phrase in
 *      half the blog. One generic bigram in a keyword list was enough to
 *      hijack every article on the site.
 *
 * So a match must be anchored on a bigram from the template's own *name*,
 * which is where the specific words are ("temperature log", "corrective
 * action", "holiday request", "cellar check"). Keyword terms add weight and
 * order the results, but can never qualify a match on their own.
 *
 * Returns [] rather than a filler set when nothing anchors. A block of
 * unrelated downloads under an article is worse than no block.
 */

import { freeTemplates } from "./index";
import type { FreeTemplate } from "./types";

/** Format and marketing words. Removed before anything else, so they can't form
 *  a bigram — "free first" was a real match on "free first aid poster". */
const STRIP = new Set([
  "free", "printable", "downloadable", "download", "editable", "blank",
  "template", "templates", "excel", "pdf", "csv", "spreadsheet", "best", "top",
  "example", "examples", "sample", "uk", "us", "ireland", "irish",
  // Connectors, so "front of house" can't anchor on the meaningless "of house".
  "of", "in", "to", "on", "at", "by", "or", "a", "an", "amp",
]);

/** Words in so many templates or so many articles that a hit means nothing. */
const GENERIC = new Set([
  "sheet", "sheets", "form", "forms", "log", "logs", "record", "records",
  "checklist", "checklists", "schedule", "book", "restaurant", "restaurants",
  "hospitality", "venue", "venues", "pub", "pubs", "bar", "bars", "cafe",
  "hotel", "hotels", "kitchen", "kitchens", "business", "staff", "team",
  "employee", "employees", "manager", "managers", "daily", "weekly", "monthly",
  "front", "house", "back", "your", "with", "and", "for", "the", "how", "what",
  "guide", "check", "checks", "sign", "off", "list", "tracker", "management",
  "system", "app", "poster", "food", "safety",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STRIP.has(w));
}

function bigrams(t: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) {
    // At least one half must carry meaning: "temperature log" yes, "log
    // sheet" no.
    if (!GENERIC.has(t[i]) || !GENERIC.has(t[i + 1])) {
      out.push(`${t[i]} ${t[i + 1]}`);
    }
  }
  return out;
}

export interface TemplateSuggestion {
  template: FreeTemplate;
  score: number;
  /** The name bigrams that anchored the match. Empty means it doesn't qualify. */
  anchors: string[];
  matched: string[];
}

export function scoreTemplates(text: string): TemplateSuggestion[] {
  const hay = ` ${tokens(text).join(" ")} `;
  if (hay.trim().length < 40) return [];

  return freeTemplates
    .map((t) => {
      const nameAnchors = bigrams(tokens(t.name));
      const kwBigrams = new Set(t.keywords.flatMap((k) => bigrams(tokens(k))));
      const unigrams = new Set(
        [t.name, ...t.keywords]
          .flatMap(tokens)
          .filter((w) => w.length > 3 && !GENERIC.has(w)),
      );

      const anchors = nameAnchors.filter((b) => hay.includes(` ${b} `));
      const matched: string[] = [...anchors];
      let score = anchors.length * 4;

      for (const b of kwBigrams) {
        if (!nameAnchors.includes(b) && hay.includes(` ${b} `)) {
          score += 2;
          matched.push(b);
        }
      }
      for (const u of unigrams) {
        if (hay.includes(` ${u} `)) {
          score += 1;
          matched.push(u);
        }
      }

      return { template: t, score, anchors, matched };
    })
    .filter((s) => s.anchors.length > 0)
    .sort((a, b) => b.score - a.score);
}

export function suggestTemplates(text: string, limit = 3): FreeTemplate[] {
  return scoreTemplates(text)
    .slice(0, limit)
    .map((s) => s.template);
}
