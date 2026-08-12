import { prisma } from "@/lib/prisma";
import { researchVenue } from "./venue-research";
import { discoverContacts } from "@/lib/public-page/contact-discovery";
import { importLeads } from "./import";

/**
 * Turn a sourced OSM venue into a sales lead, when it has a website.
 *
 * WHY THIS IS THE USEFUL HALF OF THE OSM CHANNEL
 * The channel was built to find venues with no website, because those are the
 * ones our page can outrank. Researching 25 of them found the opposite: 10 had
 * a website OSM had simply never tagged, and all 10 were domains absent from
 * OutreachLead. So the extraction found something better than it was looking
 * for — venues nobody has pitched, discovered from a source our list-building
 * never touched.
 *
 * WHY IT REUSES contact-discovery RATHER THAN BUILDING ADDRESSES
 * `info@<domain>` is one line of code and it is the single most expensive
 * mistake available here. 418 of the existing leads are already bounced, and
 * bounce rate is the primary input to sender reputation on a shared Brevo IP.
 * `discoverContacts()` only ever returns an address it literally read off a
 * page, MX-checks the domain, and returns nothing when there is nothing — which
 * is the correct outcome for most venues and not a failure.
 *
 * WHY A CONVERTED LEAD IS PARKED ON `unverified` AND NOT ON `new`
 * This is the trap in this file. `pickLeadsToSend()` orders by
 * `CASE WHEN status = 'new' THEN 0 ELSE 1`, so a freshly imported lead does not
 * merely join the queue — it goes to the *front* of it. Importing several
 * hundred scraped, never-probed addresses as `new` would put them ahead of the
 * hand-checked list on the next weekday 9am run, on the same shared Brevo IP
 * that the entire existing sequence depends on, with 418 bounces already on the
 * record. `unverified` matches none of the branches in that query and none of
 * the branches in `pickBuildCandidates()`, so a converted lead sits inert until
 * `scripts/verify-leads.ts` has probed it and something deliberately promotes
 * it. Nothing in this file sends anything.
 */

/**
 * Parking status for a converted lead. Chosen because it appears in no branch
 * of the send query and no branch of the page-build query.
 */
export const UNVERIFIED_STATUS = "unverified";

export type ConvertOutcome = {
  candidate: string;
  city: string | null;
  result:
    | "lead_created"
    | "already_a_lead"
    | "no_email"
    | "no_website"
    | "collision"
    | "dead_domain"
    | "error";
  email?: string;
  website?: string;
  detail?: string;
};

/** Normalise whatever the model returned into something fetchable. */
function tidyUrl(raw: string): string | null {
  const v = raw.trim().replace(/[.,;]+$/, "");
  if (!v || /\s/.test(v)) return null;
  const withScheme = v.startsWith("http") ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) return null;
    // A social profile is not a website, and treating one as a site sends the
    // contact scraper to a login wall.
    if (/facebook\.com|instagram\.com|twitter\.com|x\.com|linktr\.ee/i.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * A mailbox we would refuse to send to anyway.
 *
 * `hr@dinos.ie\` reached the lead table on the 12 Aug run — a trailing
 * backslash the model emitted, which every earlier check waved through because
 * they only looked for an `@`. A malformed address is worse than none: it sits
 * in the table looking sendable and fails at the provider.
 */
export function malformedEmail(email: string): boolean {
  return !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email.trim());
}

/** Strip everything but letters and digits, so "The Lady Belle" ≈ "theladybellepub". */
function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Does this mailbox look like it belongs to a differently-named business?
 *
 * Rewritten after the 12 Aug run, where the first version flagged 6 of 46 and
 * got both halves wrong:
 *
 *   false positives — "The Lady Belle" → theladybellepub@gmail.com was flagged,
 *     because only the DOMAIN was compared and the domain is gmail.com. The
 *     venue name was sitting in the local part all along. Same for Antiquity,
 *     Tom Barry's and Briar Rose. Four of the six flags were noise, which is how
 *     a flag gets ignored.
 *   misses — "Mol's Bar" → hello@oneillsbartramore.com and "Sin É" →
 *     risingsonscork@gmail.com both passed. These are the wrong venue entirely,
 *     the actual thing worth catching. They passed because tokens under 4
 *     characters were dropped, leaving "Mol" and "Sin" with nothing to compare.
 *
 * So: compare against the local part, the domain AND the source URL, match on
 * squashed substrings rather than whole words, keep 3-character tokens, and when
 * a name yields no usable token say so instead of silently passing.
 */
export function nameMismatch(name: string, email: string, website: string | null): string | null {
  /**
   * The URL PATH is deliberately excluded, only the host is compared.
   *
   * "Sin É" passed against risingsonscork@gmail.com because the site found was
   * corkheritagepubs.com/sin-e — a directory page. Every directory page carries
   * the venue name in its path, so matching the path means any directory listing
   * vouches for any mailbox printed on it. The host is the part that says whose
   * business this is.
   */
  const host = (() => {
    if (!website) return "";
    try {
      return new URL(website).hostname;
    } catch {
      return website;
    }
  })();
  const haystack = squash(`${email} ${host}`);
  /**
   * Segments, for short tokens only.
   *
   * "Sin É" passed against risingsonscork@gmail.com because "sin" is a
   * substring of "rising". Three letters are short enough to appear inside an
   * unrelated word by accident, so a 3-letter token has to line up with an
   * actual segment of the address rather than any position in it.
   */
  const segments = `${email} ${host}`
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  const generic = new Set([
    "restaurant","hotel","bar","cafe","inn","house","the","and","pub","kitchen","takeaway",
    "lounge","grill","bistro","tavern","coffee","food","company","ltd",
  ]);
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    // Plural strip, but only on a word long enough to survive it. Stripping
    // blindly turned "Cass" into "cas" and flagged cassandco.ie as a stranger.
    .map((t) => (t.length >= 5 ? t.replace(/s$/, "") : t)) // Barry's → barry
    .filter((t) => t.length >= 3 && !generic.has(t));

  if (tokens.length === 0) {
    return `"${name}" has no distinctive word to match against ${email} — confirm by hand that this mailbox is the right venue.`;
  }
  const matched = tokens.some((t) =>
    t.length >= 4
      ? haystack.includes(t)
      : // A 3-letter token must sit at a segment edge: "theoar" ends with "oar",
        // whereas "rising" merely contains "sin".
        segments.some((s) => s === t || s.startsWith(t) || s.endsWith(t))
  );
  if (!matched) {
    return `nothing in ${email}${host ? ` or ${host}` : ""} matches "${name}" — this is very likely a different business. Confirm who the inbox belongs to before addressing them by the venue name.`;
  }

  /**
   * Second rule: a mailbox on a domain that belongs to neither the venue nor
   * the venue's own site.
   *
   * The first rule alone cleared four rows that are plainly wrong, because the
   * WEBSITE matched the name while the EMAIL sat on an unrelated domain:
   *
   *   Foley's Bar, Cashel   site foleys.ie      → info@oneillsmerrionrow.ie
   *                                               (a different pub, in Dublin)
   *   Bennigan's, Clonmel   site bennigans.com  → info@lrbllc.com
   *                                               (the US franchise company)
   *   Number 21, Carrick    site number21.ie    → info@fyrefli.ie
   *                                               (the agency that built the site)
   *
   * That last one is the pattern worth naming: a web designer's footer credit
   * is on thousands of small hospitality sites, and scraping it produces a lead
   * that would be addressed as the venue. A custom domain therefore has to look
   * like the venue or like its site; free mailboxes are exempt, since gmail.com
   * cannot match anything and rule one already read their local part.
   */
  const emailDomain = email.split("@")[1]?.toLowerCase() ?? "";
  const FREE_MAIL = new Set([
    "gmail.com","hotmail.com","hotmail.co.uk","outlook.com","outlook.ie","yahoo.com","yahoo.co.uk",
    "yahoo.ie","live.com","live.ie","icloud.com","me.com","aol.com","eircom.net","btinternet.com",
    "ymail.com","googlemail.com","protonmail.com","proton.me",
  ]);
  if (emailDomain && !FREE_MAIL.has(emailDomain) && host) {
    const siteDomain = host.replace(/^www\./, "").toLowerCase();
    const sameDomain = emailDomain === siteDomain || emailDomain.endsWith(`.${siteDomain}`) || siteDomain.endsWith(`.${emailDomain}`);
    const domainMatchesName = tokens.some((t) => squash(emailDomain).includes(t));
    if (!sameDomain && !domainMatchesName) {
      return `mailbox is on ${emailDomain}, which is neither ${siteDomain} nor anything like "${name}" — often a web designer's footer credit, a franchise head office or a different venue. Confirm the mailbox before sending.`;
    }
  }

  return null;
}

/**
 * Process one candidate end to end.
 *
 * Writes the verdict to the candidate row either way, so a second run never
 * re-researches and re-pays for a row already answered.
 */
export async function convertCandidate(
  id: string,
  opts: { dry?: boolean } = {}
): Promise<ConvertOutcome> {
  const row = await prisma.venueCandidate.findUnique({ where: { id } });
  if (!row) return { candidate: id, city: null, result: "error", detail: "row vanished" };

  const base = { candidate: row.name, city: row.city };

  const verdict = await researchVenue(row);
  if ("error" in verdict) {
    return { ...base, result: "error", detail: verdict.error };
  }

  const stamp = (msg: string) =>
    `[to-lead ${new Date().toISOString().slice(0, 10)}] ${msg}${
      verdict.citations.length ? `\nsources: ${verdict.citations.slice(0, 4).join(" ")}` : ""
    }`;

  const write = async (data: Record<string, unknown>, msg: string) => {
    if (opts.dry) return;
    await prisma.venueCandidate.update({
      where: { id },
      data: { ...data, notes: row.notes ? `${row.notes}\n${stamp(msg)}` : stamp(msg) },
    });
  };

  if (verdict.nameCollision) {
    await write(
      { status: "skipped", skipReason: "name collision — sources describe a different venue" },
      "research returned a venue of the same name elsewhere"
    );
    return { ...base, result: "collision" };
  }

  const site = verdict.ownWebsite ? tidyUrl(verdict.ownWebsite) : null;
  if (!site) {
    // No website is the *good* outcome for page-building, so the row stays
    // `new` and keeps whatever contact detail research turned up.
    await write(
      {
        hasWebsite: false,
        phone: verdict.ownPhone ?? row.phone ?? undefined,
        facebook: verdict.ownFacebook ?? row.facebook ?? undefined,
        instagram: verdict.ownInstagram ?? row.instagram ?? undefined,
      },
      "no own website found — stays a page candidate"
    );
    return { ...base, result: "no_website" };
  }

  const contacts = await discoverContacts({
    name: row.name,
    website: site,
    facebook: verdict.ownFacebook ?? row.facebook,
    instagram: verdict.ownInstagram ?? row.instagram,
    knownPhone: row.phone,
  });

  // Best address first: contact-discovery already ranks generic mailboxes above
  // personal ones, and flags a domain that cannot receive mail.
  // Drop anything that isn't a syntactically valid address before the MX check —
  // `hr@dinos.ie\` got all the way into the lead table because nothing looked.
  const usable = contacts.emails.filter((e) => e.mx !== "no-mx" && !malformedEmail(e.value));

  if (usable.length === 0) {
    const why = contacts.emails.length
      ? "every address found sits on a domain that can't receive mail"
      : "no address printed on any page we could reach";
    await write(
      {
        hasWebsite: true,
        websiteFound: site,
        status: "rejected",
        skipReason: `has own website, ${why}`,
      },
      `website ${site} — ${why}`
    );
    return {
      ...base,
      result: contacts.emails.length ? "dead_domain" : "no_email",
      website: site,
      detail: why,
    };
  }

  const pick = usable[0];

  /**
   * Never touch a lead that already exists.
   *
   * `importLeads()` upserts and its update branch refreshes `name`, `segment`
   * and `city` — correct for re-importing a corrected CSV, wrong here. Two
   * different venues routinely share one mailbox: "Johnny Frank's" is a bar
   * inside the Meadowlands Hotel, so OSM lists the bar while the only published
   * address is info@meadowlandshotel.com. Converting it renamed an existing
   * lead — one that had already been sent a listing invite as "Meadowlands
   * Hotel" — to the name of its own bar. The lead's name is what appears in
   * every subsequent email, so this silently corrupts a live conversation.
   */
  const already = await prisma.outreachLead.findUnique({
    where: { email: pick.value },
    select: { name: true, status: true },
  });
  if (already) {
    await write(
      {
        hasWebsite: true,
        websiteFound: site,
        status: "rejected",
        skipReason: `has own website; mailbox ${pick.value} already belongs to lead "${already.name}"`,
        email: pick.value,
      },
      `website ${site} → mailbox already a lead ("${already.name}", ${already.status}) — left untouched`
    );
    return {
      ...base,
      result: "already_a_lead",
      email: pick.value,
      website: site,
      detail: `mailbox already belongs to "${already.name}"`,
    };
  }

  if (!opts.dry) {
    await importLeads([
      {
        name: row.name,
        email: pick.value,
        segment: row.amenity === "cafe" ? "Cafe" : row.amenity === "pub" || row.amenity === "bar" ? "Pub" : "Restaurant",
        city: row.city ?? "",
        region: "",
        country: row.country,
        // Traceable back to this pass, so these can be isolated later if their
        // bounce rate turns out worse than the hand-built list.
        source: "osm-discovery",
      },
    ]);

    // Flag a mailbox that plainly belongs to a differently-named business.
    //
    // "Connie Foxe's Bar and Steakhouse" publishes info@imperialhoteltralee.ie,
    // because the bar sits inside the Imperial Hotel. The address is genuinely
    // theirs, so this is not a reason to discard the lead — but an email opening
    // "I built a page for Connie Foxe's" lands with whoever reads the hotel's
    // inbox, and if the hotel is later sourced under its own name we would hold
    // two leads on one mailbox. Recording it means a human can see it before a
    // send rather than after.
    const flag = nameMismatch(row.name, pick.value, site);

    // Park it out of the sequence's reach. Scoped to a lead that has never been
    // contacted, so re-running this can never drag an address that is already
    // three emails deep back to the start — `importLeads` deliberately leaves an
    // existing lead's status alone, and this must not undo that.
    await prisma.outreachLead.updateMany({
      where: { email: pick.value, status: "new", contactCount: 0, lastContacted: null },
      data: {
        status: UNVERIFIED_STATUS,
        notes:
          `[osm-discovery ${new Date().toISOString().slice(0, 10)}] address read from ${pick.source}. ` +
          `Parked as ${UNVERIFIED_STATUS} — probe with scripts/verify-leads.ts before any send.` +
          (flag ? `\n[check name] ${flag}` : ""),
      },
    });
  }

  await write(
    {
      hasWebsite: true,
      websiteFound: site,
      status: "rejected",
      skipReason: "has own website — converted to a sales lead",
      email: pick.value,
    },
    `website ${site} → lead ${pick.value} (read from ${pick.source})`
  );

  return { ...base, result: "lead_created", email: pick.value, website: site };
}

export type ConvertRun = {
  outcomes: ConvertOutcome[];
  counts: Record<string, number>;
  leadsBefore: number;
  leadsAfter: number;
};

export async function convertBatch(
  limit: number,
  opts: {
    dry?: boolean;
    country?: string;
    /**
     * Called as each row finishes. The batch fetches pages from hundreds of
     * unrelated servers over tens of minutes, so printing only at the end means
     * one bad host loses the whole run's output — which is exactly what happened
     * on the first 60-row attempt: an HTTP/2 session error killed the process
     * after 58 rows had already been written to the database.
     */
    onOutcome?: (o: ConvertOutcome, index: number, total: number) => void;
  } = {}
): Promise<ConvertRun> {
  const rows = await prisma.venueCandidate.findMany({
    where: {
      status: "new",
      hasWebsite: null,
      ...(opts.country ? { country: opts.country } : {}),
    },
    // Rows with a phone or social already on file research more reliably, so
    // the sample tells us about the channel rather than about sparse rows.
    orderBy: [{ phone: "desc" }, { facebook: "desc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true },
  });

  const leadsBefore = await prisma.outreachLead.count();
  const outcomes: ConvertOutcome[] = [];
  const counts: Record<string, number> = {};

  for (let i = 0; i < rows.length; i++) {
    // One unreachable venue must never end the batch: everything before it is
    // already committed, and everything after it is still worth doing.
    let out: ConvertOutcome;
    try {
      out = await convertCandidate(rows[i].id, opts);
    } catch (err) {
      out = { candidate: rows[i].id, city: null, result: "error", detail: (err as Error).message };
    }
    outcomes.push(out);
    counts[out.result] = (counts[out.result] ?? 0) + 1;
    opts.onOutcome?.(out, i + 1, rows.length);
    // Paid research call plus several fetches against a stranger's server.
    await new Promise((res) => setTimeout(res, 1500));
  }

  const leadsAfter = await prisma.outreachLead.count();
  return { outcomes, counts, leadsBefore, leadsAfter };
}
