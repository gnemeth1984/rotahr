/**
 * The Copilot's prompt boundary.
 *
 * Agents return findings with `subjects` (guest and staff names) and `draft`s
 * (messages addressed to a named guest). Those are for the manager's own
 * screen. What may reach an external model is only the PII-free part: agent
 * headlines, finding titles/details, metrics and small numeric tables.
 *
 * Three layers, failing closed:
 *  1. Structural: subjects, drafts, hrefs and ids are dropped, never copied.
 *  2. Textual: emails/phones/IBANs/PPS numbers are scrubbed (scrubText), and
 *     any guest or staff name the agents saw is replaced with "[name]".
 *  3. Seal: sealPulse() walks the result and throws on banned keys or
 *     identifiers that survived; we add a phone check on top. A throw means the
 *     caller uses the deterministic text and no prompt is sent.
 */
import { PulseLeakError, scrubText, sealPulse } from "@/lib/navigator/rotahr/redact";
import type { AgentResult, Finding } from "./types";

export interface PromptFinding {
  severity: Finding["severity"];
  title: string;
  detail?: string;
}

export interface PromptAgent {
  agent: AgentResult["agent"];
  label: string;
  status: AgentResult["status"];
  headline: string;
  findings: PromptFinding[];
  metrics: Record<string, number | string | null>;
  table?: { columns: string[]; rows: (string | number | null)[][] };
}

export interface PromptPayload {
  business: string;
  venue: string | null;
  date: string;
  agents: PromptAgent[];
  tonight?: Record<string, number | string | null>;
}

const PHONE_STRICT = /(?:\+\d[\d\s().-]{7,}\d)|(?:\b0\d{2,4}[\s-]?\d{3}[\s-]?\d{3,4}\b)/;

/** Name tokens to withhold: every word of 3+ letters in a guest/staff label. */
export function nameTerms(names: Iterable<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const n of names) {
    if (!n) continue;
    const full = n.trim();
    if (full.length >= 3) out.add(full);
    for (const w of full.split(/[\s,]+/)) {
      const t = w.replace(/[^\p{L}'-]/gu, "");
      if (t.length >= 3) out.add(t);
    }
  }
  // Longest first so "Mary Kelly" is replaced before "Mary".
  return [...out].sort((a, b) => b.length - a.length);
}

/** Names behind reservation/employee subjects (label up to " · " or " — "). */
export function subjectNames(results: AgentResult[]): string[] {
  const names: string[] = [];
  for (const r of results)
    for (const f of r.findings)
      for (const s of f.subjects ?? [])
        if (s.type === "reservation" || s.type === "employee") names.push(s.label.split(/ · | — /)[0]);
  return names;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function makeScrubber(terms: string[]) {
  const re = terms.length ? new RegExp(`(?<![\\p{L}])(?:${terms.map(escapeRe).join("|")})(?![\\p{L}])`, "giu") : null;
  return (text: string, max = 300) => {
    let t = scrubText(text, 2000);
    if (re) t = t.replace(re, "[name]");
    return t.slice(0, max);
  };
}

function assertNoPhones(node: unknown, path = "$"): void {
  if (node == null) return;
  if (typeof node === "string") {
    if (PHONE_STRICT.test(node)) throw new PulseLeakError(path, "string contains a phone number");
    return;
  }
  if (Array.isArray(node)) return node.forEach((v, i) => assertNoPhones(v, `${path}[${i}]`));
  if (typeof node === "object") for (const [k, v] of Object.entries(node)) assertNoPhones(v, `${path}.${k}`);
}

/**
 * Builds the only object that may be serialised into a prompt. Throws
 * (PulseLeakError) rather than return anything doubtful.
 */
export function toPromptPayload(input: {
  businessName: string;
  venueName: string | null;
  date: string;
  results: AgentResult[];
  tonight?: Record<string, number | string | null>;
  /** Extra names to withhold (e.g. every guest booked today). */
  extraNames?: Iterable<string | null | undefined>;
}): PromptPayload {
  const terms = nameTerms([...subjectNames(input.results), ...(input.extraNames ?? [])]);
  const clean = makeScrubber(terms);
  const payload: PromptPayload = {
    business: clean(input.businessName, 120),
    venue: input.venueName ? clean(input.venueName, 120) : null,
    date: input.date,
    agents: input.results.map((r) => ({
      agent: r.agent,
      label: r.label,
      status: r.status,
      headline: clean(r.headline),
      findings: r.findings.slice(0, 12).map((f) => ({
        severity: f.severity,
        title: clean(f.title),
        ...(f.detail ? { detail: clean(f.detail) } : {}),
      })),
      metrics: Object.fromEntries(
        Object.entries(r.metrics).map(([k, v]) => [k, typeof v === "string" ? clean(v, 60) : v]),
      ),
      ...(r.table
        ? {
            table: {
              columns: r.table.columns.map((c) => clean(c, 40)),
              rows: r.table.rows.slice(0, 14).map((row) => row.map((c) => (typeof c === "string" ? clean(c, 60) : c))),
            },
          }
        : {}),
    })),
    ...(input.tonight
      ? {
          tonight: Object.fromEntries(
            Object.entries(input.tonight).map(([k, v]) => [k, typeof v === "string" ? clean(v, 60) : v]),
          ),
        }
      : {}),
  };
  sealPulse(payload);
  assertNoPhones(payload);
  return payload;
}
