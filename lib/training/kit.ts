/**
 * Shared building blocks for the in-house courses.
 *
 * courses.ts owns the course list, grading and the allergen content. Anything a
 * second or third course also needs lives here instead, so course content files
 * (fire.ts and the ones after it) can import the shapes without importing
 * courses.ts and creating a cycle.
 */

export interface Lesson {
  id: string;
  title: string;
  /** Paragraphs. Plain text — rendered as <p>. */
  body: string[];
  /** Optional bullet list rendered under the body. */
  bullets?: string[];
  /**
   * Rendered as a highlighted box. Use for the one thing they must not get
   * wrong in that lesson.
   */
  keyPoint?: string;
}

export interface QuizQuestion {
  id: string;
  /** "single" = one correct option. "multi" = zero or more. */
  kind: "single" | "multi";
  prompt: string;
  /** Extra context under the prompt. */
  note?: string;
  options: string[];
  /** Indexes into options. Server-side only — never sent to the client. */
  correct: number[];
  /** Shown on the result page. */
  why: string;
}

/** Deterministic shuffle so a given seed always yields the same paper. */
export function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// --------------------------------------------------------------------------- //
// The venue's own equipment, as a course sees it
// --------------------------------------------------------------------------- //

/**
 * Asset categories that carry a real fire risk in a hospitality building.
 * Cooking is the obvious one; extraction (hvac) is the one that burns buildings
 * down because the grease sits where nobody looks; electrical because a
 * distribution board or a failing motor is the classic overnight ignition.
 */
const FIRE_RISK_CATEGORIES = new Set(["cooking", "hvac", "electrical"]);

/** Names that mean "hot oil" whatever category somebody filed them under. */
const FRYER_PATTERN = /fry|frier|fryer|chip\b/i;

export interface CourseAsset {
  id: string;
  name: string;
  category: string;
  location: string | null;
  status: string;
  /** ISO date or null. */
  nextServiceDate: string | null;
  /** Service date recorded and already in the past. */
  serviceOverdue: boolean;
  /** Carries a fire risk worth naming in the lesson. */
  fireRisk: boolean;
  /** Holds hot oil — the highest-consequence item in most kitchens. */
  fryer: boolean;
}

/** Narrow a Prisma Asset row into what a course uses. */
export function toCourseAsset(row: any): CourseAsset {
  const next = row.nextServiceDate ? new Date(row.nextServiceDate) : null;
  const category = row.category ?? "other";
  const name = row.name ?? "";
  const fryer = FRYER_PATTERN.test(name);
  return {
    id: row.id,
    name,
    category,
    location: row.location ?? null,
    status: row.status ?? "active",
    nextServiceDate: next ? next.toISOString() : null,
    // Compared against the start of today rather than the exact clock, so a
    // paper rebuilt twenty minutes later during grading is identical.
    serviceOverdue: Boolean(next && next.getTime() < new Date().setHours(0, 0, 0, 0)),
    fireRisk: FIRE_RISK_CATEGORIES.has(category) || fryer,
    fryer,
  };
}

// --------------------------------------------------------------------------- //
// The venue's own stock list, as a course sees it
// --------------------------------------------------------------------------- //

/**
 * A pack weight at or above this is worth planning rather than just picking up.
 * It is NOT a legal limit and it is not the guideline maximum — published
 * guidance charts sit higher than this. It is the point at which the manual
 * handling course stops calling something "a box" and starts calling it a load.
 */
const HEAVY_KG = 10;

/** Reads "5kg", "2.5 kg", "10L", "500ml", "100 gm" out of an item name. */
const WEIGHT_IN_NAME = /(\d+(?:[.,]\d+)?)\s*(kgs?|kilos?|gms?|g|litres?|liters?|ltrs?|l|mls?)\b/i;

export interface CourseStock {
  id: string;
  name: string;
  unit: string;
  category: string;
  /** Weight of one pack in kg, when the venue actually recorded one. */
  kg: number | null;
  /** Volume of one pack in litres, when the venue actually recorded one. */
  litres: number | null;
  /** A keg — heavy, awkward, and the classic cellar injury. */
  keg: boolean;
  /** Worth a team lift, a trolley or a decant. */
  heavy: boolean;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Narrow a Prisma StockItem row into what a course uses.
 *
 * Weights are only ever READ, never guessed. First choice is the recorded pack
 * size; failing that, a figure the venue typed into the item name itself. If
 * neither exists the course says so rather than inventing a number.
 */
export function toCourseStock(row: any): CourseStock {
  const name: string = row.name ?? "";
  const unit: string = (row.unit ?? "unit").toLowerCase();
  let kg: number | null = null;
  let litres: number | null = null;

  const packSize = typeof row.packSize === "number" ? row.packSize : null;
  const packUnit = (row.packUnit ?? "").toString().trim().toLowerCase();
  if (packSize && packSize > 0) {
    if (packUnit === "kg") kg = packSize;
    else if (packUnit === "g") kg = packSize / 1000;
    else if (packUnit === "litre" || packUnit === "liter" || packUnit === "l") litres = packSize;
    else if (packUnit === "ml") litres = packSize / 1000;
  }

  if (kg === null && litres === null) {
    const m = WEIGHT_IN_NAME.exec(name);
    if (m) {
      const value = Number(m[1].replace(",", "."));
      const u = m[2].toLowerCase();
      if (Number.isFinite(value) && value > 0) {
        if (u.startsWith("kg") || u.startsWith("kilo")) kg = value;
        else if (u === "g" || u.startsWith("gm")) kg = value / 1000;
        else if (u === "l" || u.startsWith("litre") || u.startsWith("liter") || u.startsWith("ltr"))
          litres = value;
        else if (u.startsWith("ml")) litres = value / 1000;
      }
    }
  }

  const keg = unit === "keg" || /\bkegs?\b/i.test(name) || /\bcask\b/i.test(name);
  // A litre of anything a kitchen buys weighs about a kilo, so volume counts
  // toward the same threshold. Kegs are heavy before anything is in them.
  const heavy =
    keg || (kg !== null && kg >= HEAVY_KG) || (litres !== null && litres >= HEAVY_KG);

  return {
    id: row.id,
    name,
    unit: row.unit ?? "unit",
    category: row.category ?? "general",
    kg: kg === null ? null : round1(kg),
    litres: litres === null ? null : round1(litres),
    keg,
    heavy,
  };
}

/** "20 kg", "50 L", or null when the venue never recorded a figure. */
export function stockWeight(item: CourseStock): string | null {
  if (item.kg !== null) return `${item.kg} kg`;
  if (item.litres !== null) return `${item.litres} L`;
  return null;
}

// --------------------------------------------------------------------------- //
// The venue's own HACCP units and check schedule, as a course sees it
// --------------------------------------------------------------------------- //

/**
 * Target ranges per unit type.
 *
 * These MIRROR the thresholds the HACCP module already enforces in
 * app/(app)/haccp/page.tsx (CHECK_GROUPS). They are duplicated rather than
 * imported because that file is a large client component and importing it into
 * server course code would drag the whole tree along. If the thresholds there
 * change, change them here in the same commit — a course that teaches a
 * different number from the one the app marks against is worse than no course.
 *
 * The figures themselves are the widely used ones, not universal law. Fridge
 * maximums, hot-holding minimums and core cooking temperatures all differ
 * between countries; the module is deliberately set tighter than the legal
 * maximum in several of them, and that headroom is the point.
 */
export const HACCP_TARGETS: Record<
  string,
  { label: string; target: string; min: number | null; max: number | null; note: string }
> = {
  fridge: {
    label: "Fridge / cold room",
    target: "1 to 4°C",
    min: 1,
    max: 4,
    note: "Checked twice a day by default. Tighter than the legal maximum in several countries, on purpose — a unit sitting at the limit has nowhere to go on a hot Saturday.",
  },
  freezer: {
    label: "Freezer",
    target: "-25 to -18°C",
    min: -25,
    max: -18,
    note: "Checked daily by default. -18°C or colder is the figure used almost everywhere.",
  },
  hot_holding: {
    label: "Hot holding",
    target: "above 63°C",
    min: 63,
    max: 100,
    note: "Checked every two hours by default. 63°C is the UK and Ireland figure; the US works to 60°C (140°F).",
  },
  cooking: {
    label: "Cooking",
    target: "core above 75°C",
    min: 75,
    max: 100,
    note: "Core temperature, taken in the thickest part. Recorded per cook rather than on a clock.",
  },
  cooling: {
    label: "Cooling",
    target: "60°C down to below 4°C within 4 hours",
    min: 0,
    max: 4,
    note: "Recorded per batch. The clock matters as much as the temperature.",
  },
};

/** Human labels for the check types a schedule can be set against. */
export const HACCP_CHECK_LABELS: Record<string, string> = {
  fridge_temp: "Fridge / cold room temperatures",
  freezer_temp: "Freezer temperatures",
  hot_holding: "Hot holding temperatures",
  cooking_temp: "Cooking temperatures",
  cooling: "Cooling records",
  delivery: "Delivery checks",
  cleaning_daily: "Daily cleaning",
  cleaning_weekly: "Weekly cleaning",
  cleaning_deep: "Deep clean",
  opening_checks: "Opening checks",
  closing_checks: "Closing checks",
  pest_control: "Pest control log",
  corrective_action: "Corrective action log",
};

export interface CourseHaccpUnit {
  id: string;
  name: string;
  /** fridge | freezer | hot_holding | cooking | cooling | other */
  type: string;
  /** "Fridge / cold room" */
  typeLabel: string;
  /** "1 to 4°C" — the range this venue's own module marks against. */
  target: string;
  min: number | null;
  max: number | null;
}

/** Narrow a Prisma HACCPEquipment row into what a course uses. */
export function toCourseHaccpUnit(row: any): CourseHaccpUnit {
  const type: string = row.equipType ?? "other";
  const t = HACCP_TARGETS[type];
  return {
    id: row.id,
    name: row.name ?? "",
    type,
    typeLabel: t?.label ?? "Other unit",
    target: t?.target ?? "no target range recorded",
    min: t?.min ?? null,
    max: t?.max ?? null,
  };
}

export interface CourseHaccpCheck {
  checkType: string;
  label: string;
  /** "HH:mm" strings the venue set. */
  times: string[];
  /** 0=Sun..6=Sat. Empty means every day. */
  daysOfWeek: number[];
  active: boolean;
}

/** Narrow a Prisma HACCPSchedule row into what a course uses. */
export function toCourseHaccpCheck(row: any): CourseHaccpCheck {
  const times = Array.isArray(row.times) ? row.times.filter((t: any) => typeof t === "string") : [];
  const days = Array.isArray(row.daysOfWeek)
    ? row.daysOfWeek.filter((d: any) => typeof d === "number")
    : [];
  const checkType: string = row.checkType ?? "";
  return {
    checkType,
    label: HACCP_CHECK_LABELS[checkType] ?? checkType.replace(/_/g, " "),
    times,
    daysOfWeek: days,
    active: row.active !== false,
  };
}

// --------------------------------------------------------------------------- //
// The venue's own monitoring log, as a course sees it
// --------------------------------------------------------------------------- //

/**
 * One logged HACCP check, narrowed for a course.
 *
 * This carries the reading and the unit or supplier the record names. Equipment
 * and suppliers are the venue's own property, not people, so printing "Main
 * Walk-In Fridge" in a lesson is safe and useful. What never travels is who
 * logged it: a course that printed "Tommy logged this at 6°C and passed it" on
 * a page every colleague opens — and then froze that into the stored completion
 * snapshot forever — would be issuing a disciplinary, not teaching. There is no
 * checkedById here on purpose.
 */
export interface CourseHaccpLog {
  checkType: string;
  /** "Fridge / cold room temperatures" */
  label: string;
  /** ISO date string. */
  checkedAt: string;
  /** "pass" | "fail" | whatever the module wrote. */
  status: string;
  /** The numeric reading the record carried, if any. */
  reading: number | null;
  /** Which field the reading came from — "temp", "coreTemp", "endTemp", "deliveryTemp". */
  readingKind: string | null;
  /** The unit or supplier named on the record. Never a person. */
  subject: string | null;
  /** True when somebody wrote something in the notes field. */
  hasNotes: boolean;
  /** How many checklist items were ticked, for the tick-list check types. */
  tickedCount: number;
}

/** Narrow a Prisma HACCPRecord row into what a course uses. */
export function toCourseHaccpLog(row: any): CourseHaccpLog {
  const checkType: string = row.checkType ?? "";
  const data = row.data && typeof row.data === "object" ? row.data : {};

  // The module writes the reading under a different key per check type.
  const keys = ["temp", "coreTemp", "endTemp", "deliveryTemp"];
  let reading: number | null = null;
  let readingKind: string | null = null;
  for (const k of keys) {
    const v = (data as any)[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      reading = v;
      readingKind = k;
      break;
    }
  }

  const subjectRaw =
    (data as any).equipment ?? (data as any).supplier ?? (data as any).item ?? null;
  const items = Array.isArray((data as any).items) ? (data as any).items : [];

  const checkedAt = row.checkedAt instanceof Date ? row.checkedAt : new Date(row.checkedAt);

  return {
    checkType,
    label: HACCP_CHECK_LABELS[checkType] ?? checkType.replace(/_/g, " "),
    checkedAt: checkedAt.toISOString(),
    status: (row.status ?? "").toString() || "unknown",
    reading,
    readingKind,
    subject:
      typeof subjectRaw === "string" && subjectRaw.trim() ? subjectRaw.trim() : null,
    hasNotes: typeof row.notes === "string" && row.notes.trim().length > 0,
    tickedCount: items.length,
  };
}

// --------------------------------------------------------------------------- //
// The venue's own cleaning records, as a course sees it
// --------------------------------------------------------------------------- //

/** The five checklist types a venue actually cleans against. */
export const CLEANING_CHECK_TYPES = [
  "cleaning_daily",
  "cleaning_weekly",
  "cleaning_deep",
  "opening_checks",
  "closing_checks",
] as const;

/**
 * The default task lists behind each of those checklists.
 *
 * These MIRROR the defaults in app/(app)/haccp/page.tsx (DAILY_CLEANING_ITEMS
 * and the four beside it). They are duplicated rather than imported because
 * that file is a large client component and importing it into server course
 * code would drag the whole tree along. If a list changes there, change it here
 * in the same commit — the cleaning course counts against these lengths, so a
 * course teaching "6 of 8" against a 9-item list is worse than no course.
 *
 * A venue can edit its own lists (HACCPChecklistTemplate). Those edits feed a
 * LESSON only, never the quiz: a manager editing a list mid-course must not be
 * able to change the paper that is being graded.
 */
export const DEFAULT_CLEANING_ITEMS: Record<string, string[]> = {
  cleaning_daily: [
    "Kitchen prep surfaces wiped and sanitised",
    "Cooking equipment cleaned (fryers, grills, ovens)",
    "Fridge/freezer door seals wiped",
    "Sinks and taps sanitised",
    "Floor swept and mopped",
    "Bins emptied and cleaned",
    "Hand washing stations stocked (soap, paper towels)",
    "Dishwasher/glasswasher cleaned and checked",
  ],
  cleaning_weekly: [
    "Behind/under cooking equipment cleaned",
    "Extraction hood and filters degreased",
    "Cold room/walk-in walls and floors scrubbed",
    "Dry store shelves wiped and organised",
    "Waste area cleaned and disinfected",
    "Drains cleaned and deodorised",
    "Bar fridges deep cleaned",
  ],
  cleaning_deep: [
    "Full extraction system cleaned",
    "All equipment moved and cleaned behind/under",
    "Grease traps cleaned",
    "All walls and ceilings wiped down",
    "All drains jet washed",
    "Pest control check completed",
    "Signed off by manager",
  ],
  opening_checks: [
    "All fridge/freezer temps within safe range",
    "Hand washing facilities clean and stocked",
    "All food covered and correctly labelled",
    "Prep surfaces sanitised before use",
    "Date labels checked — remove expired stock",
    "Pest check — no signs of activity",
    "Equipment working correctly (no faults)",
  ],
  closing_checks: [
    "All food stored, covered and labelled",
    "Cooking equipment switched off and cleaned",
    "Surfaces wiped and sanitised",
    "Floor swept and mopped",
    "Bins emptied",
    "Fridges/freezers closed and temps normal",
    "Gas/electrics checked",
  ],
};

export interface CourseCleaningRecord {
  id: string;
  /** cleaning_daily | cleaning_weekly | cleaning_deep | opening_checks | closing_checks */
  checkType: string;
  /** "Daily cleaning" */
  label: string;
  /** ISO date of the check itself, not of the row. */
  checkedAt: string;
  /** "pass" | "fail" | whatever the module wrote. */
  status: string;
  /** How many tasks were actually ticked on that record. */
  tickedCount: number;
  /** How many tasks the default list for that checklist holds. */
  expectedCount: number;
  notes: string | null;
}

/**
 * Narrow a Prisma HACCPRecord row (a cleaning type) into what a course uses.
 *
 * data.items is the list of tasks that were TICKED, so its length against the
 * default list length is the whole partial-record lesson. Nothing is invented:
 * a record with no items array reads as 0 ticked, which is exactly what it is.
 */
export function toCourseCleaningRecord(row: any): CourseCleaningRecord {
  const checkType: string = row.checkType ?? "";
  const data = row.data && typeof row.data === "object" ? row.data : {};
  const items = Array.isArray((data as any).items)
    ? (data as any).items.filter((i: any) => typeof i === "string")
    : [];
  const checkedAt = row.checkedAt ? new Date(row.checkedAt) : new Date(row.createdAt ?? Date.now());
  return {
    id: row.id,
    checkType,
    label: HACCP_CHECK_LABELS[checkType] ?? checkType.replace(/_/g, " "),
    checkedAt: checkedAt.toISOString(),
    status: (row.status ?? "").toString() || "unknown",
    tickedCount: items.length,
    expectedCount: (DEFAULT_CLEANING_ITEMS[checkType] ?? []).length,
    notes: typeof row.notes === "string" && row.notes.trim() ? row.notes.trim() : null,
  };
}

/** A checklist a venue has actually edited for itself. Lesson-only. */
export interface CourseCleaningTemplate {
  checkType: string;
  label: string;
  itemCount: number;
}

/** Narrow a Prisma HACCPChecklistTemplate row into what a course uses. */
export function toCourseCleaningTemplate(row: any): CourseCleaningTemplate {
  const checkType: string = row.checkType ?? "";
  const items = Array.isArray(row.items) ? row.items.filter((i: any) => typeof i === "string") : [];
  return {
    checkType,
    label: HACCP_CHECK_LABELS[checkType] ?? checkType.replace(/_/g, " "),
    itemCount: items.length,
  };
}

// --------------------------------------------------------------------------- //
// The venue's own delivery checks, as a course sees it
// --------------------------------------------------------------------------- //

/**
 * A logged goods-in check.
 *
 * HACCPRecord.data for checkType "delivery" has been written by three different
 * routes over the life of the module, so the shape varies: the manual form
 * writes { supplier, deliveryTemp }, the older form adds { product, accepted,
 * packagingCondition }, and the delivery-note scanner writes { items[],
 * itemCount, invoiceUrl, invoiceDate }. Every field here is therefore optional
 * and nothing is defaulted to a number — a missing temperature reads as null,
 * which is the whole point of the strongest lesson in the course.
 */
export interface CourseDelivery {
  id: string;
  /** ISO date of the check itself. */
  checkedAt: string;
  supplier: string | null;
  /** Degrees C as logged, or null when nobody recorded one. */
  temp: number | null;
  /** Line count, from itemCount or the items array. Null when neither exists. */
  itemCount: number | null;
  /** True when an invoice or delivery-note image is attached to the record. */
  hasInvoice: boolean;
  /** "good" | "damaged" | whatever the form wrote, or null. */
  packagingCondition: string | null;
  /** "pass" | "fail" | whatever the module wrote. */
  status: string;
  notes: string | null;
}

/** Narrow a Prisma HACCPRecord row (checkType "delivery") into course shape. */
export function toCourseDelivery(row: any): CourseDelivery {
  const data = row.data && typeof row.data === "object" ? row.data : {};
  const d = data as any;

  const rawTemp = d.deliveryTemp;
  const temp = typeof rawTemp === "number" && Number.isFinite(rawTemp) ? rawTemp : null;

  const items = Array.isArray(d.items) ? d.items : null;
  const rawCount = typeof d.itemCount === "number" ? d.itemCount : null;
  const itemCount = rawCount ?? (items ? items.length : null);

  const supplier =
    typeof d.supplier === "string" && d.supplier.trim() ? d.supplier.trim() : null;

  const checkedAt = row.checkedAt ? new Date(row.checkedAt) : new Date(row.createdAt ?? Date.now());

  return {
    id: row.id,
    checkedAt: checkedAt.toISOString(),
    supplier,
    temp,
    itemCount,
    hasInvoice: typeof d.invoiceUrl === "string" && d.invoiceUrl.length > 0,
    packagingCondition:
      typeof d.packagingCondition === "string" && d.packagingCondition.trim()
        ? d.packagingCondition.trim()
        : null,
    status: (row.status ?? "").toString() || "unknown",
    notes: typeof row.notes === "string" && row.notes.trim() ? row.notes.trim() : null,
  };
}

/**
 * A guest profile, reduced to shape only.
 *
 * Deliberately carries NO guest name, email, phone, note text or allergy text.
 * A privacy course that printed a real guest's name and their "SEVERE nut
 * allergy" note onto a training page shown to every member of staff would be
 * teaching the opposite of its own lesson — and the completion stores a snapshot
 * of whatever the course read, so that text would then sit in the evidence
 * record forever. Counts and booleans are enough to teach from.
 */
export interface CourseCustomer {
  id: string;
  /** ISO date the profile was created. */
  createdAt: string;
  /** GDPR / marketing consent flag as recorded. */
  consent: boolean;
  /** ISO date consent was given, or null when the flag is set with no date. */
  consentAt: string | null;
  /** SMS / WhatsApp consent — a separate permission, not implied by the above. */
  smsConsent: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  hasBirthday: boolean;
  /** Allergy text present. Health data about an identifiable person. */
  hasAllergyData: boolean;
  hasDietaryNotes: boolean;
  /** Free-text internal note present — readable by staff, disclosable to the guest. */
  hasInternalNotes: boolean;
  /** Length of the internal note in characters. Never its content. */
  noteLength: number;
  tagCount: number;
  anonymised: boolean;
}

/** Narrow a Prisma Customer row into what the course uses. */
export function toCourseCustomer(row: any): CourseCustomer {
  const txt = (v: any) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const notes = txt(row.internalNotes);
  const created = row.createdAt ? new Date(row.createdAt) : new Date();

  return {
    id: row.id,
    createdAt: created.toISOString(),
    consent: row.gdprConsent === true,
    consentAt: row.gdprConsentAt ? new Date(row.gdprConsentAt).toISOString() : null,
    smsConsent: row.smsWhatsappConsent === true,
    hasEmail: !!txt(row.email),
    hasPhone: !!txt(row.phone),
    hasBirthday: !!row.birthday,
    hasAllergyData: !!txt(row.allergies),
    hasDietaryNotes: !!txt(row.dietaryNotes),
    hasInternalNotes: !!notes,
    noteLength: notes ? notes.length : 0,
    tagCount: Array.isArray(row.tags) ? row.tags.length : 0,
    anonymised: row.isAnonymised === true,
  };
}

/**
 * A rostered shift, reduced to what the course teaches from.
 *
 * Carries NO employee name — the same instinct as CourseCustomer. A working
 * time course that printed "Tommy Ryan worked 11 hours with no break" onto a
 * page every member of staff opens, and then froze that line into the stored
 * completion snapshot forever, would be handing out a grievance rather than
 * training. employeeId is kept only so distinct people can be counted.
 */
export interface CourseShift {
  id: string;
  employeeId: string | null;
  /** ISO date of the shift. */
  date: string;
  startTime: string;
  endTime: string;
  /** Rostered length in hours, end minus start. Never negative. */
  hours: number;
  published: boolean;
  overtimeHours: number;
}

/** Narrow a Prisma Shift row into course shape. No name, ever. */
export function toCourseShift(row: any): CourseShift {
  const start = new Date(row.startTime);
  const end = new Date(row.endTime);
  const raw = (end.getTime() - start.getTime()) / 3600000;
  const hours = Number.isFinite(raw) && raw > 0 ? Math.round(raw * 100) / 100 : 0;

  return {
    id: row.id,
    employeeId: typeof row.employeeId === "string" ? row.employeeId : null,
    date: new Date(row.date).toISOString(),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    hours,
    published: row.published === true,
    overtimeHours: typeof row.overtimeHours === "number" ? row.overtimeHours : 0,
  };
}

/**
 * Clock activity as counts only.
 *
 * ClockEvent rows can run to thousands and the course only ever teaches from
 * totals, so this is summed in the API route and travels as one small object.
 * Break events are the interesting number: a break nobody recorded cannot be
 * evidenced later, and at the time of writing no venue on the platform had
 * recorded a single one.
 */
export interface CourseClock {
  ins: number;
  outs: number;
  breakStarts: number;
  breakEnds: number;
  /** ISO timestamp of the most recent event of any type, or null. */
  latest: string | null;
}

/** Sum a set of Prisma ClockEvent rows into course shape. */
export function toCourseClock(rows: any[]): CourseClock {
  const count = (t: string) => rows.filter((r) => r.type === t).length;
  let latest: number | null = null;
  for (const r of rows) {
    const t = new Date(r.timestamp).getTime();
    if (Number.isFinite(t) && (latest === null || t > latest)) latest = t;
  }
  return {
    ins: count("in"),
    outs: count("out"),
    breakStarts: count("break_start"),
    breakEnds: count("break_end"),
    latest: latest === null ? null : new Date(latest).toISOString(),
  };
}

export function niceDate(iso: string | null): string {
  if (!iso) return "no date recorded";
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
