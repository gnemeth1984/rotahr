/**
 * Staff CSV import — parsing and validation only, no database access, so the
 * same code drives the preview and the real import and can be tested alone.
 *
 * Accepts whatever a venue is likely to export: a payroll export, a Google
 * Sheet, a spreadsheet someone typed up. Headers are matched loosely ("First
 * name", "firstname", "Forename" all work) and a single "Name" column is split
 * on the last space when there are no separate first/last columns.
 */

export const MAX_IMPORT_ROWS = 200;

export interface StaffCsvRow {
  /** 1-based line number in the file, header = line 1, for error messages. */
  line: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  hourlyRate?: number;
  department?: string;
  errors: string[];
}

/** RFC 4180-ish: quoted fields, doubled quotes, commas/newlines inside quotes, ; or tab delimiters. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = { ",": 0, ";": 0, "\t": 0 } as Record<string, number>;
  for (const ch of firstLine) if (ch in counts) counts[ch]++;
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const delim = n > 0 ? best : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === delim) { row.push(field); field = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
      continue;
    }
    field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const ALIASES: Record<string, string[]> = {
  firstName: ["first name", "firstname", "first", "forename", "given name", "givenname"],
  lastName: ["last name", "lastname", "last", "surname", "family name", "familyname", "second name"],
  name: ["name", "full name", "fullname", "employee", "employee name", "staff name"],
  email: ["email", "e-mail", "email address", "e-mail address", "mail"],
  phone: ["phone", "mobile", "phone number", "mobile number", "tel", "telephone", "cell"],
  role: ["role", "position", "job title", "title", "job"],
  hourlyRate: ["hourly rate", "rate", "hourly", "wage", "pay rate", "rate per hour", "hourly wage"],
  department: ["department", "dept", "section", "team", "area"],
};

function norm(h: string): string {
  return h.trim().toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").replace(/\s*\(.*\)$/, "");
}

export function mapHeaders(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((h, idx) => {
    const n = norm(h);
    for (const [key, names] of Object.entries(ALIASES)) {
      if (map[key] === undefined && (names.includes(n) || names.includes(n.replace(/\s/g, "")))) map[key] = idx;
    }
  });
  return map;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRate(raw: string): number | undefined | null {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t.replace(/[€£$\s]/g, "").replace(/,(\d{1,2})$/, ".$1").replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 && n < 1000 ? Math.round(n * 100) / 100 : null;
}

export interface ParsedStaffCsv {
  rows: StaffCsvRow[];
  /** Problems with the file as a whole (missing columns, too many rows). */
  fileErrors: string[];
  columns: string[];
}

export function parseStaffCsv(input: string): ParsedStaffCsv {
  const all = parseCsv(input);
  if (all.length === 0) return { rows: [], fileErrors: ["The file is empty."], columns: [] };

  const header = all[0];
  const map = mapHeaders(header);
  const fileErrors: string[] = [];
  const hasName = map.firstName !== undefined || map.name !== undefined;
  if (!hasName) fileErrors.push('No name column found. Use "First name" and "Last name", or a single "Name" column.');
  if (map.email === undefined) fileErrors.push('No email column found. Add an "Email" column — it is how each person logs in.');

  let body = all.slice(1);
  if (body.length > MAX_IMPORT_ROWS) {
    fileErrors.push(`Only the first ${MAX_IMPORT_ROWS} rows are imported at a time; the file has ${body.length}.`);
    body = body.slice(0, MAX_IMPORT_ROWS);
  }

  const get = (r: string[], key: string) => (map[key] !== undefined ? (r[map[key]] ?? "").trim() : "");
  const seen = new Map<string, number>();

  const rows: StaffCsvRow[] = body.map((r, i) => {
    const line = i + 2;
    const errors: string[] = [];
    let firstName = get(r, "firstName");
    let lastName = get(r, "lastName");
    if (!firstName && !lastName) {
      const full = get(r, "name").replace(/\s+/g, " ").trim();
      const comma = full.indexOf(",");
      if (comma > 0) {
        // "Smith, John" — payroll exports often put the surname first.
        lastName = full.slice(0, comma).trim();
        firstName = full.slice(comma + 1).trim();
      } else {
        const cut = full.lastIndexOf(" ");
        if (cut > 0) { firstName = full.slice(0, cut); lastName = full.slice(cut + 1); }
        else firstName = full;
      }
    }
    // A one-word name is common in hospitality ("Ana"); the app needs a last name, so use a dot.
    if (firstName && !lastName) lastName = ".";
    if (!firstName) errors.push("missing name");
    if (firstName.length > 50 || lastName.length > 50) errors.push("name longer than 50 characters");

    const email = get(r, "email").toLowerCase();
    if (!email) errors.push("missing email");
    else if (!EMAIL_RE.test(email)) errors.push("email doesn't look valid");
    else if (seen.has(email)) errors.push(`same email as line ${seen.get(email)}`);
    if (email && !seen.has(email)) seen.set(email, line);

    const rate = parseRate(get(r, "hourlyRate"));
    if (rate === null) errors.push("hourly rate isn't a number");

    const role = (get(r, "role") || "staff").slice(0, 50);
    const phone = get(r, "phone").slice(0, 30) || undefined;
    const department = get(r, "department").slice(0, 80) || undefined;

    return {
      line,
      firstName: firstName.slice(0, 50),
      lastName: lastName.slice(0, 50),
      email,
      phone,
      role,
      hourlyRate: rate ?? undefined,
      department,
      errors,
    };
  });

  return { rows, fileErrors, columns: Object.keys(map) };
}

export const STAFF_CSV_TEMPLATE =
  "First name,Last name,Email,Phone,Role,Hourly rate,Department\n" +
  "Aoife,Byrne,aoife@example.ie,0871234567,Server,13.50,Front of house\n" +
  "Tomasz,Nowak,tomasz@example.ie,0857654321,Chef de partie,15.00,Kitchen\n";
