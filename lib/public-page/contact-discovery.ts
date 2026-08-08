import { checkDomain, domainOf } from "@/lib/outreach/mx-check";
import { fetchPage } from "@/lib/ai/venue-extract";
import { normaliseEmail } from "@/lib/email/suppression";

/**
 * Find a contact address for a venue we only have a name and a map pin for.
 *
 * THE ONE RULE: NEVER CONSTRUCT AN ADDRESS
 * It is trivial to write `info@${domain}` and it looks like it works. It does
 * not. Guessed addresses either bounce or, worse, land at a catch-all where
 * nobody reads them, and bounce rate is the primary input to sender reputation
 * on a shared Brevo IP — 430 of the existing 1,758 leads are already bounced.
 * So every address returned here was literally present in a page we fetched.
 * When there is nothing to find, this returns nothing, which is a valid and
 * common outcome rather than a failure.
 *
 * WHY THE MX CHECK MATTERS EVEN FOR SCRAPED ADDRESSES
 * Restaurant websites go stale. An address printed on a page in 2019 can sit
 * there years after the domain stopped accepting mail. Checking DNS is free and
 * catches the dead ones before they cost a send.
 */

/**
 * Local parts that belong to the platform, the theme or a tool — not to anyone
 * who can decide anything about the venue.
 *
 * Anchored to the whole local part on purpose. An earlier version matched these
 * as substrings anywhere after the "@", which quietly rejected real addresses:
 * `hello@supportivefoods.ie` contains "support", and `info@testadomain.ie`
 * contains "test".
 */
const NOT_THE_VENUE_LOCAL =
  /^(no-?reply|noreply|donotreply|do-not-reply|postmaster|abuse|webmaster|hostmaster|privacy|dmca|legal|compliance|security|support|helpdesk|sentry[0-9a-f]*|wordpress|user|username|yourname|youremail|your-email|email|name|example|sample|test|demo|placeholder)$/i;

/** Domains that host the site or the tooling rather than the business. */
const PLATFORM_DOMAINS = new Set([
  "wix.com",
  "wixpress.com",
  "squarespace.com",
  "shopify.com",
  "godaddy.com",
  "weebly.com",
  "wordpress.com",
  "sentry.io",
  "google.com",
  "gstatic.com",
  "facebook.com",
  "instagram.com",
  "example.com",
  "domain.com",
  "sentry-next.wixpress.com",
]);

/** File extensions that regex-match an email pattern inside asset filenames. */
const ASSET_TAIL = /\.(png|jpe?g|gif|svg|webp|css|js|woff2?|ttf|ico|pdf|mp4)$/i;

export type ContactConfidence = "found" | "uncertain";

export interface ContactCandidate {
  value: string;
  /** Which page it was read from. */
  source: string;
  confidence: ContactConfidence;
  /** MX verdict for an email's domain: ok / no-mx / unknown. */
  mx?: "ok" | "no-mx" | "unknown";
  note?: string;
}

export interface DiscoveredContacts {
  emails: ContactCandidate[];
  phones: ContactCandidate[];
  /** Social/other handles worth having when there's no email at all. */
  socials: ContactCandidate[];
  /** Pages actually fetched, so a human can see where we looked. */
  checked: string[];
  notes: string[];
}

/** Pages a venue's contact details are realistically on. */
const CONTACT_PATHS = [
  "",
  "/contact",
  "/contact-us",
  "/contactus",
  "/about",
  "/about-us",
  "/reservations",
  "/bookings",
  "/book",
  "/find-us",
];

function extractEmails(html: string, text: string): string[] {
  const out = new Set<string>();

  // mailto: first — an explicit link is a much stronger signal than a pattern
  // match in body text, which catches image filenames and tracking pixels.
  const mailto = /mailto:([^"'?>\s]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = mailto.exec(html))) out.add(m[1]);

  const inText = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  while ((m = inText.exec(text))) out.add(m[0]);
  while ((m = inText.exec(html))) out.add(m[0]);

  // Obfuscated: "hello (at) venue.ie", "hello [at] venue [dot] ie".
  //
  // Deliberately strict. A looser version of this matched ordinary sentences —
  // "...gre at food. Great..." became `gre@food.great` — so the separator must
  // be *marked up* as an obfuscation: bracketed at, or the word "dot" spelled
  // out. Bare "x at y.z" is prose far more often than it is an address.
  const bracketAt = /([A-Za-z0-9._%+-]{2,})\s*[[({<]\s*(?:at|@)\s*[\])}>]\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})/gi;
  while ((m = bracketAt.exec(text))) out.add(`${m[1]}@${m[2]}`);

  const spelledDot =
    /([A-Za-z0-9._%+-]{2,})\s*(?:[[({<]\s*)?(?:at|@)(?:\s*[\])}>])?\s*([A-Za-z0-9-]+)\s*(?:[[({<]\s*)?dot(?:\s*[\])}>])?\s*([A-Za-z]{2,6})\b/gi;
  while ((m = spelledDot.exec(text))) out.add(`${m[1]}@${m[2]}.${m[3]}`);

  return [...out];
}

function plausibleEmail(raw: string): boolean {
  const e = normaliseEmail(raw.replace(/^mailto:/i, "").replace(/[<>(),;'"]/g, ""));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e)) return false;
  if (ASSET_TAIL.test(e)) return false;
  const [localPart, domain] = e.split("@");
  if (NOT_THE_VENUE_LOCAL.test(localPart)) return false;
  if (PLATFORM_DOMAINS.has(domain)) return false;
  // Reserved test domains per RFC 2606 — always a placeholder in page copy.
  if (/(^|\.)(example\.(com|net|org)|test|invalid|localhost)$/i.test(domain)) return false;
  // Hex blobs and long random locals are cache-busting artefacts, not people.
  if (localPart.length > 40) return false;
  if (/^[0-9a-f]{16,}$/i.test(localPart)) return false;
  return true;
}

function cleanEmail(raw: string): string {
  return normaliseEmail(raw.replace(/^mailto:/i, "").replace(/[<>(),;'"]/g, ""));
}

/**
 * Rank addresses by how likely they are to be read by someone who can make a
 * decision. A generic venue mailbox beats a named individual: it survives staff
 * turnover, and cold-mailing a named person is a harder GDPR position than
 * mailing a business address.
 */
function scoreEmail(email: string): number {
  const local = email.split("@")[0];
  if (/^(hello|hi|info|contact|enquir|eat|book|reservation|bookings|admin|mail|office)/i.test(local)) return 0;
  if (/^(manager|management|gm|owner|director|head)/i.test(local)) return 1;
  return 2;
}

function extractPhones(html: string, text: string): string[] {
  const out = new Set<string>();
  const tel = /tel:([+0-9()\-.\s]{6,})/gi;
  let m: RegExpExecArray | null;
  while ((m = tel.exec(html))) out.add(m[1].trim());
  // Irish/UK shapes: +353..., 0xx xxxxxxx, (0xx) xxxxxxx
  const inText = /(?:\+353|\+44|\+1|\(?0\d{1,3}\)?)[\s\-.]?\d{2,4}[\s\-.]?\d{3,4}(?:[\s\-.]?\d{0,4})?/g;
  while ((m = inText.exec(text))) out.add(m[0].trim());
  return [...out]
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.replace(/\D/g, "").length >= 7 && p.replace(/\D/g, "").length <= 15);
}

function socialsFrom(html: string): { facebook?: string; instagram?: string } {
  const fb = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._%-]{2,}/i);
  const ig = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._%-]{2,}/i);
  const bad = /\/(sharer|share\.php|plugins|tr\?|policies|about|legal)/i;
  return {
    facebook: fb && !bad.test(fb[0]) ? fb[0] : undefined,
    instagram: ig && !bad.test(ig[0]) ? ig[0] : undefined,
  };
}

export interface DiscoverInput {
  name?: string | null;
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  /** Phone already known from the map pin, so we don't report it as a discovery. */
  knownPhone?: string | null;
}

/**
 * Look for contact details across whatever surfaces we have.
 *
 * Deliberately bounded: a handful of fetches against one or two hosts. This runs
 * inside an admin request, and crawling a whole site to find an address that
 * usually isn't there is not worth the latency or the load on their server.
 */
export async function discoverContacts(input: DiscoverInput): Promise<DiscoveredContacts> {
  const emails = new Map<string, ContactCandidate>();
  const phones = new Map<string, ContactCandidate>();
  const socials = new Map<string, ContactCandidate>();
  const checked: string[] = [];
  const notes: string[] = [];

  function noteEmail(raw: string, source: string) {
    if (!plausibleEmail(raw)) return;
    const e = cleanEmail(raw);
    if (!emails.has(e)) {
      emails.set(e, { value: e, source, confidence: "found" });
    }
  }

  function notePhone(raw: string, source: string) {
    const digits = raw.replace(/\D/g, "");
    const known = (input.knownPhone ?? "").replace(/\D/g, "");
    if (known && digits.endsWith(known.slice(-7))) return; // already have it
    if (!phones.has(digits)) phones.set(digits, { value: raw, source, confidence: "found" });
  }

  // --- the venue's own website -------------------------------------------
  if (input.website) {
    let base: URL | null = null;
    try {
      base = new URL(input.website.startsWith("http") ? input.website : `https://${input.website}`);
    } catch {
      notes.push(`Website "${input.website}" isn't a usable URL.`);
    }

    if (base) {
      // The URL exactly as given goes first. Deriving everything from
      // `origin` alone silently drops a path, so a site living at
      // /en/ or a one-page site under a subdirectory would never be read at all.
      const targets = [
        base.toString(),
        ...CONTACT_PATHS.map((p) => `${base.origin}${p}`),
      ];

      for (const url of [...new Set(targets)]) {
        // Stop early once we have a good generic mailbox — no reason to keep
        // hitting someone's server for a second opinion.
        if ([...emails.values()].some((c) => scoreEmail(c.value) === 0)) break;

        const page = await fetchPage(url);
        checked.push(url + (page.ok ? "" : " (no response)"));
        if (!page.ok) continue;

        const html = page.html ?? "";
        for (const e of extractEmails(html, page.text)) noteEmail(e, url);
        for (const p of extractPhones(html, page.text)) notePhone(p, url);
        const s = socialsFrom(html);
        if (s.facebook && !socials.has(s.facebook))
          socials.set(s.facebook, { value: s.facebook, source: url, confidence: "found" });
        if (s.instagram && !socials.has(s.instagram))
          socials.set(s.instagram, { value: s.instagram, source: url, confidence: "found" });
      }
    }
  }

  // --- Facebook page -----------------------------------------------------
  // Facebook hides nearly everything behind a login now, so this usually yields
  // nothing. It costs one fetch and occasionally the About blurb still carries
  // an address, which is worth having when there's no website at all.
  const fbUrl = input.facebook || [...socials.values()].find((s) => /facebook\.com/i.test(s.value))?.value;
  if (fbUrl) {
    for (const u of [fbUrl, `${fbUrl.replace(/\/$/, "")}/about`]) {
      const page = await fetchPage(u);
      checked.push(u + (page.ok ? "" : " (no response)"));
      if (!page.ok) continue;
      const html = page.html ?? "";
      for (const e of extractEmails(html, page.text)) noteEmail(e, "Facebook");
      for (const p of extractPhones(html, page.text)) notePhone(p, "Facebook");
    }
    if (![...emails.values()].some((c) => c.source === "Facebook")) {
      notes.push("Facebook returned nothing usable — it hides contact details behind a login.");
    }
  }

  // --- Instagram bio -----------------------------------------------------
  if (input.instagram) {
    const page = await fetchPage(input.instagram);
    checked.push(input.instagram + (page.ok ? "" : " (no response)"));
    if (page.ok) {
      const blurb = `${page.meta["og:description"] ?? ""} ${page.text.slice(0, 4000)}`;
      for (const e of extractEmails(page.html ?? "", blurb)) noteEmail(e, "Instagram bio");
    }
  }

  // --- validate what we found -------------------------------------------
  const list = [...emails.values()].sort((a, b) => scoreEmail(a.value) - scoreEmail(b.value));
  const domains = [...new Set(list.map((c) => domainOf(c.value)))];
  const verdicts = new Map<string, Awaited<ReturnType<typeof checkDomain>>>();
  await Promise.all(
    domains.map(async (d) => {
      verdicts.set(d, await checkDomain(d));
    })
  );

  for (const c of list) {
    const v = verdicts.get(domainOf(c.value));
    c.mx = v?.verdict;
    if (v?.verdict === "no-mx") {
      c.confidence = "uncertain";
      c.note = `Domain can't receive mail (${v.detail}) — sending would bounce.`;
    } else if (v?.verdict === "unknown") {
      c.note = "Couldn't check DNS just now.";
    }
  }

  if (list.length === 0) {
    notes.push(
      "No email address found on any page we could reach. Not guessing one — a made-up address bounces and damages sender reputation."
    );
  }

  return {
    emails: list,
    phones: [...phones.values()].slice(0, 4),
    socials: [...socials.values()].slice(0, 4),
    checked: checked.slice(0, 14),
    notes,
  };
}
