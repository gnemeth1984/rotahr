/**
 * Manager Copilot — the tenant-scoped Ops Navigator.
 *
 * Every agent is deterministic: it reads this business's own data, applies
 * rules, and returns findings. An LLM is optional and only ever rephrases or
 * answers questions over the *sealed* output of these agents (lib/copilot/
 * redact.ts). Nothing here writes to the business's data or contacts anyone:
 * suggestions are links into the app and draft text a manager can copy.
 */

export type Severity = "high" | "medium" | "low";

export type AgentKey = "compliance" | "margin" | "waste" | "bookings" | "noshow";

export const AGENT_LABELS: Record<AgentKey, string> = {
  compliance: "Compliance Monitor",
  margin: "Margin Guard",
  waste: "Stock Waste Advisor",
  bookings: "Booking Forecast",
  noshow: "No-show Guard",
};

/**
 * Who or what a finding is about, for display in the tenant's own UI only.
 * `subject` (and `draft`) are stripped before anything reaches a prompt,
 * because they carry guest and staff names.
 */
export interface FindingSubject {
  type: "reservation" | "employee" | "dish" | "stockItem" | "task" | "check";
  id?: string;
  label: string;
}

export interface FindingDraft {
  kind: "message" | "price" | "order-note";
  label: string;
  text: string;
}

export interface Finding {
  id: string;
  severity: Severity;
  /** Short, PII-free sentence. Safe for prompts. */
  title: string;
  /** Optional PII-free explanation. Safe for prompts. */
  detail?: string;
  /** Where in RotaHR the manager acts on it. */
  href?: string;
  subjects?: FindingSubject[];
  draft?: FindingDraft;
}

export type AgentStatus = "ok" | "watch" | "act" | "unavailable";

export interface AgentResult {
  agent: AgentKey;
  label: string;
  status: AgentStatus;
  headline: string;
  /** Business-wide data even when a venue is selected (HACCP, stock, dishes). */
  businessWide?: boolean;
  findings: Finding[];
  metrics: Record<string, number | string | null>;
  /** Optional small PII-free table for the UI (e.g. the 7-day forecast). */
  table?: { columns: string[]; rows: (string | number | null)[][] };
  error?: string;
}

export interface CopilotScope {
  businessId: string;
  businessName: string;
  venueId: string | null;
  venueName: string | null;
  timezone: string;
  currency: string;
  /** Venue-local YYYY-MM-DD the brief is for. */
  date: string;
  now: Date;
  /** Per-request memo so agents sharing a query (reservations) run it once. */
  memo?: Map<string, Promise<unknown>>;
}

export function memo<T>(scope: CopilotScope, key: string, fn: () => Promise<T>): Promise<T> {
  if (!scope.memo) scope.memo = new Map();
  let p = scope.memo.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fn();
    scope.memo.set(key, p);
  }
  return p;
}

export const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function statusFromFindings(findings: Finding[]): AgentStatus {
  if (findings.some((f) => f.severity === "high")) return "act";
  if (findings.some((f) => f.severity === "medium")) return "watch";
  return "ok";
}

export function sortFindings<T extends Finding>(findings: T[]): T[] {
  return [...findings].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
