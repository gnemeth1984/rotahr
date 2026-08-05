import { prisma } from "@/lib/db";
import { normaliseEmail } from "@/lib/email/suppression";

export type LeadRow = {
  name: string;
  email: string;
  segment?: string;
  city?: string;
  region?: string;
  country?: string;
  source?: string;
};

/** Markets the sequence has pricing for. Anything else falls back to `ie`. */
const KNOWN_MARKETS = ["ie", "uk", "us", "ca", "au"];

/** Minimal RFC-4180 splitter: handles quoted fields and escaped quotes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function normaliseCountry(raw: string | undefined): string {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return "ie";
  const alias: Record<string, string> = {
    ireland: "ie",
    ie: "ie",
    eire: "ie",
    gb: "uk",
    uk: "uk",
    "united kingdom": "uk",
    england: "uk",
    scotland: "uk",
    wales: "uk",
    "northern ireland": "uk",
    us: "us",
    usa: "us",
    "united states": "us",
    ca: "ca",
    canada: "ca",
    au: "au",
    australia: "au",
  };
  const mapped = alias[v] ?? v;
  return KNOWN_MARKETS.includes(mapped) ? mapped : "ie";
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function parseLeadCsv(csv: string): { rows: LeadRow[]; skipped: number } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], skipped: 0 };

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };

  const iName = idx("name", "business", "business_name", "company");
  const iEmail = idx("email", "email_address");
  const iSegment = idx("segment", "type", "category");
  const iCity = idx("city", "town");
  const iRegion = idx("region", "county", "state", "province");
  const iCountry = idx("country", "market");
  const iSource = idx("source", "source_file");

  if (iEmail === -1) return { rows: [], skipped: lines.length - 1 };

  const seen = new Set<string>();
  const rows: LeadRow[] = [];
  let skipped = 0;

  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const email = normaliseEmail(cols[iEmail] ?? "");

    // A malformed address burns sending reputation for nothing, and duplicates
    // inside one file would fight each other in the same upsert batch.
    if (!EMAIL_RE.test(email) || seen.has(email)) {
      skipped++;
      continue;
    }
    seen.add(email);

    rows.push({
      email,
      name: (iName !== -1 ? cols[iName] : "") || email.split("@")[0],
      segment: (iSegment !== -1 ? cols[iSegment] : "") || "Restaurant",
      city: (iCity !== -1 ? cols[iCity] : "") || "",
      region: (iRegion !== -1 ? cols[iRegion] : "") || "",
      country: normaliseCountry(iCountry !== -1 ? cols[iCountry] : undefined),
      source: (iSource !== -1 ? cols[iSource] : "") || undefined,
    });
  }

  return { rows, skipped };
}

export type ImportResult = {
  received: number;
  created: number;
  updated: number;
  suppressedSkipped: number;
  failed: number;
};

/**
 * Upserts leads by email.
 *
 * Two deliberate rules:
 *  - An address on the suppression list is never imported. Re-adding someone
 *    who opted out is the one mistake that turns into a complaint.
 *  - An existing lead keeps its `status`, `lastContacted` and `contactCount`.
 *    Re-importing a file must not restart the sequence for someone already
 *    three emails deep.
 */
export async function importLeads(rows: LeadRow[]): Promise<ImportResult> {
  const result: ImportResult = {
    received: rows.length,
    created: 0,
    updated: 0,
    suppressedSkipped: 0,
    failed: 0,
  };
  if (!rows.length) return result;

  const emails = rows.map((r) => normaliseEmail(r.email));

  const [suppressedRows, existingRows] = await Promise.all([
    prisma.emailSuppression.findMany({
      where: { email: { in: emails }, revokedAt: null },
      select: { email: true },
    }),
    prisma.outreachLead.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    }),
  ]);

  const suppressed = new Set(suppressedRows.map((r) => r.email));
  const existing = new Set(existingRows.map((r) => r.email));

  for (const row of rows) {
    const email = normaliseEmail(row.email);
    if (suppressed.has(email)) {
      result.suppressedSkipped++;
      continue;
    }

    try {
      await prisma.outreachLead.upsert({
        where: { email },
        create: {
          email,
          name: row.name,
          segment: row.segment || "Restaurant",
          city: row.city || "",
          region: row.region || "",
          country: row.country || "ie",
          source: row.source,
        },
        // Contact details are refreshed; sequence position is left alone.
        update: {
          name: row.name,
          segment: row.segment || "Restaurant",
          city: row.city || "",
          region: row.region || "",
          country: row.country || "ie",
          source: row.source,
        },
      });
      if (existing.has(email)) result.updated++;
      else result.created++;
    } catch {
      result.failed++;
    }
  }

  return result;
}
