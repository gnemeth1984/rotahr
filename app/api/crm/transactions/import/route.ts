import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureLoyaltyConfig, pointsForSpend } from "@/lib/crm/loyalty";
import { recomputeGuestStats } from "@/lib/crm/stats";
import { logActivity } from "@/lib/services/activity.service";

/**
 * CSV import of per-guest spend.
 *
 * Guests are matched, never guessed at: email, then phone, then exact name
 * within the same business. Anything that does not match is reported back as a
 * skipped row with the reason, so a manager can fix the file rather than end up
 * with a pile of half-identified duplicate guests.
 *
 * Two-step by design: POST with dryRun true returns the parse + match report,
 * POST with dryRun false writes it. The UI always previews first.
 */

const MAX_ROWS = 2000;
const MAX_BYTES = 2_000_000;

function guard(session: any) {
  if (!session?.user?.businessId) return { error: "Unauthorized", status: 401 };
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return { error: "Forbidden", status: 403 };
  return null;
}

/** Delimiter of the header line: comma, or semicolon for European exports. */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semis) return "\t";
  return semis > commas ? ";" : ",";
}

/** Minimal RFC4180-ish parser: quoted fields, escaped quotes, CRLF or LF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  const delim = detectDelimiter(src);

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (c === "\r") {
      // swallow, \n handles the break
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const HEADER_ALIASES: Record<string, string[]> = {
  name: ["name", "guest", "guest name", "customer", "customer name", "full name"],
  email: ["email", "e-mail", "email address", "guest email", "customer email"],
  phone: ["phone", "mobile", "telephone", "phone number", "guest phone", "customer phone"],
  date: ["date", "visit date", "transaction date", "day", "datetime", "closed at"],
  totalSpend: ["amount", "total", "total spend", "spend", "net total", "gross", "bill", "value", "revenue"],
  covers: ["covers", "guests", "party size", "pax", "seats"],
  items: ["items", "item", "dishes", "products", "order", "lines"],
  notes: ["notes", "note", "comment", "comments"],
  posRef: ["posref", "pos ref", "reference", "ref", "ticket", "ticket id", "receipt", "receipt no", "check", "check number", "order id", "transaction id"],
};

function mapHeaders(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((raw, idx) => {
    const key = raw.trim().toLowerCase().replace(/_/g, " ");
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[field] === undefined && aliases.includes(key)) map[field] = idx;
    }
  });
  return map;
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.replace(/[^0-9.,\-]/g, "").trim();
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // 1.234,56 -> 1234.56
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string): Date | null {
  const s = (raw || "").trim();
  if (!s) return null;
  // dd/mm/yyyy or dd-mm-yyyy, the Irish/UK spreadsheet default
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    let year = Number(y);
    if (year < 100) year += 2000;
    const dt = new Date(Date.UTC(year, Number(mo) - 1, Number(d), 12, 0, 0));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function normPhone(p: string | null | undefined): string {
  return (p || "").replace(/[^0-9]/g, "").slice(-9);
}

type ParsedRow = {
  line: number;
  name: string;
  email: string;
  phone: string;
  date: Date | null;
  totalSpend: number | null;
  covers: number | null;
  itemsText: string | null;
  notes: string | null;
  posRef: string | null;
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const csv: string = typeof body?.csv === "string" ? body.csv : "";
  const dryRun: boolean = body?.dryRun !== false;
  if (!csv.trim()) return NextResponse.json({ error: "No CSV content" }, { status: 400 });
  if (csv.length > MAX_BYTES)
    return NextResponse.json({ error: "File is too large (2MB max)" }, { status: 400 });

  const rows = parseCsv(csv);
  if (rows.length < 2)
    return NextResponse.json({ error: "CSV needs a header row and at least one data row" }, { status: 400 });

  const headerMap = mapHeaders(rows[0]);
  if (headerMap.date === undefined || headerMap.totalSpend === undefined) {
    return NextResponse.json(
      {
        error:
          "Could not find a date column and an amount column. Expected headers like: name, email, phone, date, amount, covers, items, notes, reference",
        headersFound: rows[0].map((h) => h.trim()),
      },
      { status: 400 }
    );
  }
  if (headerMap.email === undefined && headerMap.phone === undefined && headerMap.name === undefined) {
    return NextResponse.json(
      { error: "Need at least one of email, phone or name so rows can be matched to a guest" },
      { status: 400 }
    );
  }

  const dataRows = rows.slice(1, MAX_ROWS + 1);
  const truncated = rows.length - 1 > MAX_ROWS;

  const parsed: ParsedRow[] = dataRows.map((r, i) => {
    const at = (k: string) => (headerMap[k] === undefined ? "" : (r[headerMap[k]] ?? "").trim());
    const coversRaw = at("covers");
    const covers = coversRaw ? parseInt(coversRaw, 10) : NaN;
    return {
      line: i + 2,
      name: at("name"),
      email: at("email").toLowerCase(),
      phone: at("phone"),
      date: parseDate(at("date")),
      totalSpend: parseAmount(at("totalSpend")),
      covers: Number.isFinite(covers) && covers >= 0 ? covers : null,
      itemsText: at("items") || null,
      notes: at("notes") || null,
      posRef: at("posRef") || null,
    };
  });

  // Guests of this business, loaded once.
  const customers = await prisma.customer.findMany({
    where: { businessId },
    select: { id: true, name: true, email: true, phone: true, isAnonymised: true },
  });
  const byEmail = new Map<string, typeof customers[number]>();
  const byPhone = new Map<string, typeof customers[number]>();
  const byName = new Map<string, typeof customers[number]>();
  const ambiguousName = new Set<string>();
  for (const c of customers) {
    if (c.email) byEmail.set(c.email.toLowerCase(), c);
    const np = normPhone(c.phone);
    if (np.length >= 7) byPhone.set(np, c);
    const nn = c.name.trim().toLowerCase();
    if (byName.has(nn)) ambiguousName.add(nn);
    else byName.set(nn, c);
  }

  const existingRefs = new Set(
    (
      await prisma.guestTransaction.findMany({
        where: { businessId, posRef: { not: null } },
        select: { posRef: true },
      })
    ).map((t) => t.posRef as string)
  );
  const existingFingerprints = new Set(
    (
      await prisma.guestTransaction.findMany({
        where: { businessId },
        select: { customerId: true, date: true, totalSpend: true },
      })
    ).map((t) => `${t.customerId}|${t.date.toISOString().slice(0, 10)}|${t.totalSpend.toFixed(2)}`)
  );

  type Ready = { row: ParsedRow; customerId: string; customerName: string };
  const ready: Ready[] = [];
  const skipped: { line: number; reason: string; detail?: string }[] = [];
  const seenInFile = new Set<string>();

  for (const row of parsed) {
    if (!row.date) {
      skipped.push({ line: row.line, reason: "Unreadable date" });
      continue;
    }
    if (row.totalSpend === null || row.totalSpend < 0) {
      skipped.push({ line: row.line, reason: "Unreadable amount" });
      continue;
    }
    if (row.totalSpend > 1_000_000) {
      skipped.push({ line: row.line, reason: "Amount looks wrong (over 1,000,000)" });
      continue;
    }

    let match = row.email ? byEmail.get(row.email) : undefined;
    if (!match && normPhone(row.phone).length >= 7) match = byPhone.get(normPhone(row.phone));
    if (!match && row.name) {
      const nn = row.name.trim().toLowerCase();
      if (ambiguousName.has(nn)) {
        skipped.push({ line: row.line, reason: "More than one guest has that name", detail: row.name });
        continue;
      }
      match = byName.get(nn);
    }
    if (!match) {
      skipped.push({
        line: row.line,
        reason: "No matching guest",
        detail: row.email || row.phone || row.name || "(blank)",
      });
      continue;
    }
    if (match.isAnonymised) {
      skipped.push({ line: row.line, reason: "Guest has been anonymised" });
      continue;
    }

    if (row.posRef && existingRefs.has(row.posRef)) {
      skipped.push({ line: row.line, reason: "Already imported (reference)", detail: row.posRef });
      continue;
    }
    const fp = `${match.id}|${row.date.toISOString().slice(0, 10)}|${row.totalSpend.toFixed(2)}`;
    if (existingFingerprints.has(fp)) {
      skipped.push({ line: row.line, reason: "Already recorded (same guest, date and amount)" });
      continue;
    }
    const fileKey = row.posRef ? `ref:${row.posRef}` : fp;
    if (seenInFile.has(fileKey)) {
      skipped.push({ line: row.line, reason: "Duplicate row inside this file" });
      continue;
    }
    seenInFile.add(fileKey);

    ready.push({ row, customerId: match.id, customerName: match.name });
  }

  const report = {
    dryRun,
    rowsRead: parsed.length,
    truncated,
    matched: ready.length,
    skipped: skipped.length,
    totalSpend: Math.round(ready.reduce((s, r) => s + (r.row.totalSpend ?? 0), 0) * 100) / 100,
    guests: Array.from(new Set(ready.map((r) => r.customerName))).slice(0, 50),
    preview: ready.slice(0, 10).map((r) => ({
      line: r.row.line,
      guest: r.customerName,
      date: r.row.date!.toISOString().slice(0, 10),
      amount: r.row.totalSpend,
    })),
    skippedRows: skipped.slice(0, 100),
    headersMapped: Object.keys(headerMap),
  };

  if (dryRun) return NextResponse.json(report);

  if (!ready.length) return NextResponse.json({ ...report, imported: 0 });

  const cfg = await ensureLoyaltyConfig(businessId);
  const pointsOn = cfg.settings.enabled;

  await prisma.guestTransaction.createMany({
    data: ready.map((r) => ({
      businessId,
      customerId: r.customerId,
      date: r.row.date!,
      totalSpend: Math.round((r.row.totalSpend ?? 0) * 100) / 100,
      covers: r.row.covers,
      itemsText: r.row.itemsText,
      notes: r.row.notes,
      posRef: r.row.posRef,
      source: "csv",
      recordedById: session!.user.id ?? null,
      recordedBy: session!.user.name ?? null,
      pointsAwarded: pointsOn ? pointsForSpend(r.row.totalSpend ?? 0, cfg.settings.pointsPerCurrency) : 0,
    })),
  });

  const affected = Array.from(new Set(ready.map((r) => r.customerId)));
  const upgrades: { name: string; from: string; to: string }[] = [];
  for (const customerId of affected) {
    const stats = await recomputeGuestStats(businessId, customerId, cfg);
    if (stats?.tierChanged) {
      const who = ready.find((r) => r.customerId === customerId)?.customerName ?? "Guest";
      upgrades.push({ name: who, from: stats.previousTier, to: stats.loyaltyTier });
    }
  }

  await logActivity({
    businessId,
    userId: session!.user.id,
    userName: session!.user.name,
    action: "crm_transactions_imported",
    details: { imported: ready.length, skipped: skipped.length, guests: affected.length },
  });

  return NextResponse.json({ ...report, imported: ready.length, guestsUpdated: affected.length, upgrades });
}
