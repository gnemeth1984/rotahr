/**
 * Lead Engine v2: trigger signals and the multi-signal lead score.
 *
 *   lead_score = hiring (per role group) + hygiene rating + enforcement order + multi-site
 *
 * Only the strongest active signal of each group counts, so two chef adverts are one "Hiring Head Chef"
 * (+40) but a chef advert plus a manager advert is +75. Stale signals stop counting:
 * job adverts after 60 days, FSAI orders after 180 days. The current FHRS rating always counts.
 */
export const SIGNAL_TYPES = ["hiring_chef", "hiring_management", "hiring_compliance", "fhrs_rating",
  "fsai_closure", "fsai_prohibition", "fsai_improvement", "multi_site"] as const;
export type SignalType = typeof SIGNAL_TYPES[number];

export const ROLE_GROUPS = {
  hiring_compliance: { points: 50, roles: ["HACCP", "Food Safety", "Quality Manager"] },
  hiring_chef: { points: 40, roles: ["Head Chef", "Executive Chef", "Sous Chef", "Kitchen Manager"] },
  hiring_management: { points: 35, roles: ["Restaurant Manager", "General Manager", "Duty Manager", "Operations Manager"] },
} as const;
export type RoleGroup = keyof typeof ROLE_GROUPS;
export const FSAI_POINTS = { closure: 100, prohibition: 90, improvement: 75 } as const;
export const MULTI_SITE_POINTS = 20;
export const JOB_MAX_AGE_DAYS = 60;
export const FSAI_MAX_AGE_DAYS = 180;
export const FHRS_REASON = "Poor hygiene rating. Rotahr HACCP records may help support future inspections.";
export const PURSUED_GRADES = ["A+", "A", "B"] as const;

export const nameKey = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/&/g, "and")
  .replace(/\b(the|ltd|limited|t\/a)\b/g, "").replace(/[^a-z0-9]/g, "");

/** Canonical role from free advert text, most specific group first. Null for roles outside the three groups. */
export function classifyRole(raw: string): { group: RoleGroup; role: string } | null {
  const t = raw.toLowerCase();
  for (const [group, def] of Object.entries(ROLE_GROUPS) as [RoleGroup, typeof ROLE_GROUPS[RoleGroup]][]) {
    for (const role of def.roles) if (t.includes(role.toLowerCase())) return { group, role };
  }
  // "Chef de Cuisine" is a head chef; "Operations Director" is not in scope.
  if (/chef de cuisine/.test(t)) return { group: "hiring_chef", role: "Head Chef" };
  return null;
}

export function fhrsPoints(rating: string): number {
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 0 || r > 5) return 0;
  return r <= 2 ? 70 : r === 3 ? 40 : r === 4 ? 10 : 0;
}
export function gradeFor(score: number): "A+" | "A" | "B" | "C" | "D" {
  return score >= 90 ? "A+" : score >= 70 ? "A" : score >= 40 ? "B" : score >= 20 ? "C" : "D";
}

export type StoredSignal = { type: string; label: string; points: number; eventDate: Date | null; observedAt: Date; sourceUrl: string; detail: string };
const GROUP: Record<SignalType, string> = {
  hiring_chef: "hiring_chef", hiring_management: "hiring_management", hiring_compliance: "hiring_compliance",
  fhrs_rating: "hygiene", fsai_closure: "enforcement", fsai_prohibition: "enforcement", fsai_improvement: "enforcement", multi_site: "multi_site",
};
export function isActive(s: StoredSignal, now = new Date()): boolean {
  const ageDays = (now.getTime() - (s.eventDate ?? s.observedAt).getTime()) / 86400000;
  if (s.type.startsWith("hiring_")) return ageDays <= JOB_MAX_AGE_DAYS;
  if (s.type.startsWith("fsai_")) return ageDays <= FSAI_MAX_AGE_DAYS;
  return SIGNAL_TYPES.includes(s.type as SignalType);
}

/** {"lead_score":110,"signals":["Hiring Head Chef","Food Hygiene Rating 2"]} plus the grade and what counted. */
export function computeLeadScore(signals: StoredSignal[], now = new Date()) {
  const best = new Map<string, StoredSignal>();
  for (const s of signals) {
    if (!isActive(s, now)) continue;
    const group = GROUP[s.type as SignalType]; if (!group) continue;
    const cur = best.get(group);
    // Hygiene: the latest inspection wins, even if an older one scored higher.
    const newer = (a: StoredSignal, b: StoredSignal) => (a.eventDate ?? a.observedAt).getTime() > (b.eventDate ?? b.observedAt).getTime();
    if (!cur || (group === "hygiene" ? newer(s, cur) : s.points > cur.points || (s.points === cur.points && newer(s, cur)))) best.set(group, s);
  }
  const counted = [...best.values()].sort((a, b) => b.points - a.points);
  const lead_score = counted.reduce((sum, s) => sum + s.points, 0);
  return { lead_score, grade: gradeFor(lead_score), signals: counted.map(s => s.label),
    breakdown: counted.map(s => ({ type: s.type, label: s.label, points: s.points, sourceUrl: s.sourceUrl, eventDate: s.eventDate?.toISOString().slice(0, 10) ?? null })) };
}

/** Parses Serper's result date ("3 days ago", "Oct 28, 2026", "2026-10-28"). Null when unknown. */
export function parsePostedDate(raw: string | undefined | null, now = new Date()): Date | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  const rel = t.match(/^(\d+)\+?\s*(minute|hour|day|week|month)s?\s+ago$/);
  if (rel) {
    const unit = { minute: 60000, hour: 3600000, day: 86400000, week: 7 * 86400000, month: 30 * 86400000 }[rel[2] as "day"];
    return new Date(now.getTime() - Number(rel[1]) * unit);
  }
  if (/^(just posted|today)$/.test(t)) return now;
  if (t === "yesterday") return new Date(now.getTime() - 86400000);
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = iso ? new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3])) : /^[a-z]{3,9}\.? \d{1,2},? \d{4}$|^\d{1,2} [a-z]{3,9}\.? \d{4}$/.test(t) ? new Date(`${t.replace(".", "")} UTC`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getTime() > now.getTime() + 86400000) return null;
  return parsed;
}

/** Words that must never appear in outreach drafts: we never cite a hygiene rating or enforcement order. */
export const FORBIDDEN_DRAFT_TERMS = /\b(hygiene|inspection|inspector|enforcement|closure|closed down|prohibition|improvement order|fsai|fhrs|food standards|food safety authority|rating|scores? on the doors|environmental health)\b/i;
