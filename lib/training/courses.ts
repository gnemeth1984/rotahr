/**
 * In-house training courses.
 *
 * Courses are code, not rows — same reasoning as the free template library. The
 * content is the same for every venue; what differs is the venue's own menu,
 * which is read at render time and woven into the lessons and the quiz.
 *
 * ── What these courses are ──────────────────────────────────────────────────
 * Employer-delivered, in-house training. That is a real and legally meaningful
 * category: an operator is generally expected to make sure staff are instructed
 * and supervised in food hygiene matters appropriate to their work, and nothing
 * about that requires an external awarding body.
 *
 * ── What they are NOT ───────────────────────────────────────────────────────
 * They are NOT accredited qualifications. Never present a completion as HACCP
 * Level 2, a food safety certificate, first aid, fire warden, instructor-led
 * manual handling, or any licensing qualification. Those require an accredited
 * provider and, in several cases, hands-on assessment. A false accreditation
 * claim on a certificate a venue shows an inspector is a much worse outcome than
 * offering no course at all.
 *
 * Every legal figure in course copy must be stated as a widely used figure with
 * a nudge to check local rules, exactly like lib/templates/types.ts requires.
 */

import { ALLERGENS, type AllergenKey, containedKeys, parseTraces } from "./allergens";
import {
  type CourseAsset,
  type CourseClock,
  type CourseHaccpCheck,
  type CourseHaccpLog,
  type CourseCleaningRecord,
  type CourseCleaningTemplate,
  type CourseCustomer,
  type CourseDelivery,
  type CourseHaccpUnit,
  type CourseShift,
  type CourseStock,
  type Lesson,
  type QuizQuestion,
  shuffled,
  toCourseAsset,
  toCourseClock,
  toCourseCleaningRecord,
  toCourseCleaningTemplate,
  toCourseCustomer,
  toCourseDelivery,
  toCourseHaccpCheck,
  toCourseHaccpLog,
  toCourseHaccpUnit,
  toCourseShift,
  toCourseStock,
} from "./kit";
import { cleaningLessons, cleaningQuiz } from "./cleaning";
import { deliveriesLessons, deliveriesQuiz } from "./deliveries";
import { fireLessons, fireQuiz } from "./fire";
import { foodHygieneLessons, foodHygieneQuiz } from "./food-hygiene";
import { haccpSystemLessons, haccpSystemQuiz } from "./haccp-system";
import { manualHandlingLessons, manualHandlingQuiz } from "./manual-handling";
import { privacyLessons, privacyQuiz } from "./privacy";
import { workingTimeLessons, workingTimeQuiz } from "./working-time";

// Shapes and helpers live in kit.ts so course content files can import them
// without importing this module back. Re-exported so existing importers and the
// API routes keep a single place to import from.
export type {
  CourseAsset,
  CourseClock,
  CourseCleaningRecord,
  CourseCleaningTemplate,
  CourseCustomer,
  CourseDelivery,
  CourseHaccpCheck,
  CourseHaccpLog,
  CourseHaccpUnit,
  CourseShift,
  CourseStock,
  Lesson,
  QuizQuestion,
};
export {
  toCourseAsset,
  toCourseClock,
  toCourseCleaningRecord,
  toCourseCleaningTemplate,
  toCourseCustomer,
  toCourseDelivery,
  toCourseHaccpCheck,
  toCourseHaccpLog,
  toCourseHaccpUnit,
  toCourseShift,
  toCourseStock,
};

export interface CourseDef {
  slug: string;
  title: string;
  /** One line, shown in the course list. */
  summary: string;
  /** Roughly how long it takes, in minutes. Be honest. */
  minutes: number;
  /** How many months the resulting record stays valid before a retrain. */
  validMonths: number;
  /** Percentage needed to pass. */
  passMark: number;
  /** Category written onto the TrainingCertification row. */
  certCategory: string;
  /** Title written onto the TrainingCertification row. */
  certTitle: string;
  /** True when the course reads the venue's own menu. */
  usesMenu: boolean;
  /** True when the course reads the venue's own equipment register. */
  usesAssets: boolean;
  /** True when the course reads the venue's own stock list. */
  usesStock: boolean;
  /** True when the course reads the venue's own HACCP units and check times. */
  usesHaccp: boolean;
  /** True when the course reads the venue's own cleaning records. */
  usesCleaning: boolean;
  /** True when the course reads the venue's own goods-in delivery records. */
  usesDeliveries: boolean;
  /**
   * True when the course reads the venue's own guest records. Shape only:
   * counts, flags and field lengths. Never a guest's name, note text or
   * allergy text — see CourseCustomer in kit.ts for why that matters.
   */
  usesCustomers: boolean;
  /**
   * True when the course reads the venue's own rota and time clock. Shape only:
   * shift lengths, gaps, totals and clock-event counts. Never an employee's
   * name — see CourseShift in kit.ts for why that matters.
   */
  usesShifts: boolean;
  /**
   * True when the course reads the venue's own logged HACCP checks — the
   * readings, the passes and fails, and how long ago each was written. Shape
   * and reading only: never who logged it, see CourseHaccpLog in kit.ts. Kept
   * separate from usesHaccp so a course can read the register and the schedule
   * without pulling hundreds of records it does not teach from.
   */
  usesHaccpLogs: boolean;
}

export const COURSES: CourseDef[] = [
  {
    slug: "allergen-awareness",
    title: "Allergen awareness",
    summary:
      "The named allergens, where they hide, what to say to a guest, and the allergens recorded on your own menu.",
    minutes: 20,
    validMonths: 12,
    passMark: 80,
    // OTHER, never HACCP. A HACCP category would file this in-house record in the
    // same bucket as a real QQI HACCP Level 1/2/3 certificate, and a manager
    // filtering the tracker by HACCP could read it as satisfying that requirement.
    certCategory: "OTHER",
    certTitle: "Allergen awareness (in-house)",
    usesMenu: true,
    usesAssets: false,
    usesStock: false,
    usesHaccp: false,
    usesCleaning: false,
    usesDeliveries: false,
    usesCustomers: false,
    usesShifts: false,
    usesHaccpLogs: false,
  },
  {
    slug: "fire-safety-awareness",
    title: "Fire safety awareness",
    summary:
      "How fires start in a working kitchen, which extinguisher matches which fire, evacuation and roll call — built around the fire-risk equipment on your own register.",
    minutes: 25,
    validMonths: 12,
    passMark: 80,
    // Deliberately OTHER, not FIRST_AID or a fire-specific claim: this is
    // awareness training, not a fire warden qualification.
    certCategory: "OTHER",
    certTitle: "Fire safety awareness (in-house)",
    usesMenu: false,
    usesAssets: true,
    usesStock: false,
    usesHaccp: false,
    usesCleaning: false,
    usesDeliveries: false,
    usesCustomers: false,
    usesShifts: false,
    usesHaccpLogs: false,
  },
  {
    slug: "manual-handling-awareness",
    title: "Manual handling awareness",
    summary:
      "Lifting, carrying, kegs, cellar drops and the injuries that build up over years — built around the heaviest items recorded on your own stock list.",
    minutes: 20,
    validMonths: 12,
    passMark: 80,
    // Deliberately OTHER rather than MANUAL_HANDLING. The accredited course is
    // hands-on by design and in several countries it is what an operator is
    // actually expected to provide; an in-house awareness record must not sit in
    // the tracker looking like it satisfies that.
    certCategory: "OTHER",
    certTitle: "Manual handling awareness (in-house)",
    usesMenu: false,
    usesAssets: false,
    usesStock: true,
    usesHaccp: false,
    usesCleaning: false,
    usesDeliveries: false,
    usesCustomers: false,
    usesShifts: false,
    usesHaccpLogs: false,
  },
  {
    slug: "food-hygiene-awareness",
    title: "Food hygiene awareness",
    summary:
      "The danger zone, the four Cs, fitness to work, and what to do when a check fails \— built around your own fridges, freezers and hot-holding units and the check times you set.",
    minutes: 25,
    validMonths: 12,
    passMark: 80,
    // Deliberately OTHER, not HACCP or FOOD_SAFETY. Both of those categories
    // exist in the tracker for the accredited qualification an operator is
    // expected to hold \— HACCP Level 1 and 2, Safe Catering and the rest. An
    // in-house awareness record filed under either would sit in the same list
    // looking like it satisfied that requirement. It does not.
    certCategory: "OTHER",
    certTitle: "Food hygiene awareness (in-house)",
    usesMenu: false,
    usesAssets: false,
    usesStock: false,
    usesHaccp: true,
    usesCleaning: false,
    usesDeliveries: false,
    usesCustomers: false,
    usesShifts: false,
    usesHaccpLogs: false,
  },
  {
    slug: "cleaning-chemical-safety",
    title: "Cleaning & chemical safety awareness",
    summary:
      "Two-stage cleaning, contact time, dilution, and the chemicals that must never meet \— checked against what your own cleaning records actually show.",
    minutes: 20,
    validMonths: 12,
    passMark: 80,
    // Deliberately OTHER. This is not a COSHH or chemical safety qualification,
    // and in several countries handling hazardous substances carries its own
    // required training. An in-house awareness record must not sit in the
    // tracker looking like it satisfied that.
    certCategory: "OTHER",
    certTitle: "Cleaning & chemical safety awareness (in-house)",
    usesMenu: false,
    usesAssets: false,
    usesStock: false,
    usesHaccp: false,
    usesCleaning: true,
    usesDeliveries: false,
    usesCustomers: false,
    usesShifts: false,
    usesHaccpLogs: false,
  },
  {
    slug: "deliveries-goods-in",
    title: "Deliveries & goods-in awareness",
    summary:
      "The cold chain, arrival temperatures, when to refuse a load, and the traceability a delivery record has to leave behind — read against your own goods-in log.",
    minutes: 20,
    validMonths: 12,
    passMark: 80,
    // Deliberately OTHER, never HACCP or FOOD_SAFETY. Goods-in is a HACCP
    // control point, so an in-house awareness record filed under HACCP would
    // sit in the tracker beside real accredited rows looking like it satisfied
    // that requirement. It does not.
    certCategory: "OTHER",
    certTitle: "Deliveries & goods-in awareness (in-house)",
    usesMenu: false,
    usesAssets: false,
    usesStock: false,
    usesHaccp: false,
    usesCleaning: false,
    usesDeliveries: true,
    usesCustomers: false,
    usesShifts: false,
    usesHaccpLogs: false,
  },
  {
    slug: "guest-data-privacy",
    title: "Guest data & privacy awareness",
    summary:
      "What counts as personal data, what a guest can ask you for, why the note field is disclosable, and how fast a suspected breach has to be escalated — read against your own guest records.",
    minutes: 20,
    validMonths: 12,
    passMark: 80,
    // Deliberately OTHER. This is employer-delivered awareness training, not a
    // data protection qualification, and it must never look like one: no DPO
    // course, no certification, no accreditation. It teaches the staff
    // instinct — what counts as personal data, what a guest can ask for, what
    // belongs in the note field, and who to escalate a suspected breach to.
    certCategory: "OTHER",
    certTitle: "Guest data & privacy awareness (in-house)",
    usesMenu: false,
    usesAssets: false,
    usesStock: false,
    usesHaccp: false,
    usesCleaning: false,
    usesDeliveries: false,
    usesCustomers: true,
    usesShifts: false,
    usesHaccpLogs: false,
  },
  {
    slug: "working-time-breaks",
    title: "Working time, breaks & rest",
    summary:
      "What counts as working time, when a break is owed, the eleven-hour turnaround, the average week, under-18s, and why the record is what protects the venue — read against your own rota and time clock.",
    minutes: 25,
    validMonths: 12,
    passMark: 80,
    // Deliberately OTHER, like every other in-house course. This is awareness
    // training for staff and managers, not employment law advice and not a
    // qualification. Working time law is set nationally, so every figure in the
    // content is introduced as a widely used figure with an instruction to
    // check the local rule — the EU directive is a floor, Ireland and the UK
    // implement it differently, and the UK opt-out does not exist here.
    certCategory: "OTHER",
    certTitle: "Working time, breaks & rest awareness (in-house)",
    usesMenu: false,
    usesAssets: false,
    usesStock: false,
    usesHaccp: false,
    usesCleaning: false,
    usesDeliveries: false,
    usesCustomers: false,
    usesShifts: true,
    usesHaccpLogs: false,
  },
  {
    slug: "haccp-system-awareness",
    title: "Your food safety management system (HACCP)",
    summary:
      "What a food safety management system actually is, the seven principles, why a step becomes a critical control point, and what a monitoring record has to be able to prove \— read against your own units, your own check times and your own logged checks.",
    minutes: 25,
    validMonths: 12,
    passMark: 80,
    // OTHER, and this one matters more than the rest. "HACCP" has an accredited
    // meaning \— QQI Level 1/2/3 Food Safety (HACCP) in Ireland, and venues
    // store those as real TrainingCertification rows with certCategory "HACCP".
    // Filing an in-house awareness record under that category would put it in
    // the same pile as the accredited article on the Certificates tab, which is
    // exactly the confusion an inspector would punish. It files as OTHER, and
    // the course copy says on its face that it does not replace the real
    // qualification. See the header of lib/training/haccp-system.ts.
    certCategory: "OTHER",
    certTitle: "Food safety management system (HACCP) awareness (in-house)",
    usesMenu: false,
    usesAssets: false,
    usesStock: false,
    usesHaccp: true,
    usesCleaning: false,
    usesDeliveries: false,
    usesCustomers: false,
    usesShifts: false,
    usesHaccpLogs: true,
  },
];

export function getCourse(slug: string): CourseDef | undefined {
  return COURSES.find((c) => c.slug === slug);
}

// --------------------------------------------------------------------------- //
// Menu shape the course needs
// --------------------------------------------------------------------------- //

export interface CourseDish {
  id: string;
  name: string;
  category: string;
  contains: AllergenKey[];
  traces: AllergenKey[];
  checked: boolean;
}

/** Everything a course may read about the venue. Grows as courses are added. */
export interface CourseData {
  dishes: CourseDish[];
  assets: CourseAsset[];
  stock: CourseStock[];
  haccp: CourseHaccpUnit[];
  /**
   * The venue's own check schedule. Used by lessons only, never by the quiz \—
   * so it does not need to be rebuildable from a ticket at grading time.
   */
  haccpChecks: CourseHaccpCheck[];
  /**
   * The venue's own logged HACCP checks, newest first. Readings, pass/fail and
   * the unit or supplier named on the record \— never who logged it.
   */
  haccpLogs: CourseHaccpLog[];
  /** The venue's own cleaning, opening and closing check records. */
  cleaning: CourseCleaningRecord[];
  /**
   * The venue's own customised cleaning checklists. Used by lessons only, never
   * by the quiz \— so they are not carried on the ticket, and the paper still
   * rebuilds identically at grading time.
   */
  cleaningTemplates: CourseCleaningTemplate[];
  /** The venue's own goods-in delivery checks, newest first. */
  deliveries: CourseDelivery[];
  /**
   * The venue's own guest records, newest first — shape only, never content.
   * Read the CourseCustomer doc comment in kit.ts before adding a field here.
   */
  customers: CourseCustomer[];
  /**
   * The venue's own rostered shifts, newest first — shape only, no names.
   * Read the CourseShift doc comment in kit.ts before adding a field here.
   */
  shifts: CourseShift[];
  /** Clock-in, clock-out and break event counts for the venue. */
  clock: CourseClock;
}

/** Narrow a Prisma dish row (with allergen columns) into what the course uses. */
export function toCourseDish(row: any): CourseDish {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? "other",
    contains: containedKeys(row),
    traces: parseTraces(row.allergenTraces),
    checked: Boolean(row.allergenCheckedAt),
  };
}

// --------------------------------------------------------------------------- //
// Lessons
// --------------------------------------------------------------------------- //

function menuLesson(dishes: CourseDish[]): Lesson {
  const checked = dishes.filter((d) => d.checked);

  if (checked.length === 0) {
    return {
      id: "your-menu",
      title: "Your own menu",
      body: [
        "This is normally the most useful lesson in the course, because it is the only part no outside training provider can give you: your own dishes, and the allergens recorded against them.",
        "Nobody has confirmed the allergen information on your menu yet, so there is nothing to show here. A manager can do that under Training → Allergen matrix. Once dishes are confirmed, this lesson and the quiz both start using them.",
      ],
      keyPoint:
        "Until your menu is filled in, treat every dish as unknown and check the recipe or supplier spec before answering a guest.",
    };
  }

  const lines = checked.map((d) => {
    const contains = d.contains.length
      ? d.contains.map((k) => ALLERGENS.find((a) => a.key === k)!.label).join(", ")
      : "nothing recorded";
    const traces = d.traces.length
      ? ` — may contain traces of ${d.traces
          .map((k) => ALLERGENS.find((a) => a.key === k)!.label)
          .join(", ")}`
      : "";
    return `${d.name}: ${contains}${traces}`;
  });

  return {
    id: "your-menu",
    title: "Your own menu",
    body: [
      "This is the part no outside training provider can give you: your own dishes, and the allergens recorded against them by your own kitchen.",
      `There ${checked.length === 1 ? "is" : "are"} ${checked.length} confirmed ${
        checked.length === 1 ? "dish" : "dishes"
      } on your menu. Read the list, then answer the questions at the end about them. You are not expected to memorise it — you are expected to know that this list exists, that it is the source of truth, and where to find it mid-service.`,
      "If a dish is not on this list, or the recipe has changed since it was confirmed, the honest answer to a guest is that you will go and check.",
    ],
    bullets: lines,
    keyPoint:
      "A recorded allergen list is only worth anything if it is updated when the recipe changes. Changing a supplier can change the allergens in a dish without the recipe looking any different.",
  };
}

export function lessonsFor(slug: string, data: CourseData): Lesson[] {
  if (slug === "fire-safety-awareness") return fireLessons(data.assets);
  if (slug === "manual-handling-awareness") return manualHandlingLessons(data.stock);
  if (slug === "food-hygiene-awareness")
    return foodHygieneLessons(data.haccp, data.haccpChecks);
  if (slug === "haccp-system-awareness")
    return haccpSystemLessons(data.haccp, data.haccpChecks, data.haccpLogs);
  if (slug === "cleaning-chemical-safety")
    return cleaningLessons(data.cleaning, data.cleaningTemplates);
  if (slug === "deliveries-goods-in") return deliveriesLessons(data.deliveries);
  if (slug === "guest-data-privacy") return privacyLessons(data.customers);
  if (slug === "working-time-breaks")
    return workingTimeLessons(data.shifts, data.clock);
  if (slug !== "allergen-awareness") return [];

  const dishes = data.dishes;

  return [
    {
      id: "why",
      title: "Why this matters",
      body: [
        "A guest with a serious food allergy is not being fussy. A reaction can start within minutes, and anaphylaxis can kill a healthy adult. The people most at risk in a restaurant are not the ones who announce it loudly at the door — they are the ones who assume the kitchen has it handled and do not ask twice.",
        "There is a second reason this training exists. In most of the world the operator is expected to be able to tell a customer what is in the food, and to be able to show that staff were instructed. The paperwork matters, but it is downstream of the real point: somebody on the floor has to know the answer, or know how to find it, at eight o'clock on a Saturday.",
        "The named list of allergens differs by country. The EU, UK and Ireland work to fourteen named allergens. The United States names nine major allergens — a shorter list that does not include celery, mustard, lupin or molluscs, though sulphites carry their own declaration rules. Australia and New Zealand use a similar list to the EU with its own lupin provisions. Learn the list that applies where you work, and check your own local rules rather than relying on the figure in any training material, including this one.",
      ],
      keyPoint:
        "Nobody is ever in trouble for saying \"let me go and check\". People end up in hospital because somebody guessed.",
    },
    {
      id: "the-list",
      title: "The named allergens, and where they hide",
      body: [
        "Knowing the names is the easy half. The half that actually protects a guest is knowing the ordinary kitchen items that carry an allergen nobody expects — the stock cube with celery in it, the soy sauce made with wheat, the Worcestershire sauce with anchovy, the vegan cheese made from cashews.",
        "Read the list below properly. Almost every real-world allergen incident in a kitchen involves one of these hiding places rather than an obvious ingredient.",
      ],
      bullets: ALLERGENS.map(
        (a) => `${a.label} — ${a.scope} Hides in: ${a.hides.slice(0, 3).join("; ")}.`
      ),
      keyPoint:
        "Pine nut and coconut are not on the EU named tree nut list, and peanut is a legume declared separately from tree nuts. Guests do not know that, so ask what they actually react to instead of assuming the list covers it.",
    },
    {
      id: "what-to-say",
      title: "What to say to a guest",
      body: [
        "There is a short script for this and it works. Ask which allergen, not whether they have an allergy. Write it down. Tell the kitchen out loud, not on a docket alone. Go and check the recorded information rather than answering from memory. Come back and say what you found, including what you could not confirm.",
        "The phrases that get people hurt are the reassuring ones: \"it should be fine\", \"there's probably none in it\", \"I think that one's OK\". If you find yourself softening an answer because you do not want to lose the table, stop and go and check instead.",
        "If you genuinely cannot confirm a dish is free of the allergen, say so and offer something you can confirm. A guest who is told the truth will order something else. A guest who is told a guess may end up in an ambulance.",
      ],
      bullets: [
        "Ask: \"Which allergen is it?\" — not \"any allergies?\"",
        "Repeat it back to the guest, and write it on the order",
        "Tell the kitchen verbally as well as on the docket",
        "Check the recorded allergen information — do not answer from memory",
        "Report back what you confirmed, and be explicit about anything you could not",
        "Never say it should be fine",
      ],
      keyPoint:
        "\"I don't know, I'll find out\" is a professional answer. Guessing is not.",
    },
    {
      id: "cross-contact",
      title: "Cross-contact in a working kitchen",
      body: [
        "An allergen does not have to be an ingredient to end up on the plate. A trace transferred by a pair of tongs, a shared fryer, a chargrill or a wiped-down board is enough to cause a reaction in a sensitive guest.",
        "The controls are unglamorous and mostly about sequence and separation: clean equipment, a dedicated area or a cleaned-down section, allergen orders prepped first or last rather than in the middle of a rush, and a physical marker on the plate so it does not get swapped on the pass.",
        "Frying is the one worth singling out. A shared fryer means a gluten-free item cooked in the oil that just cooked battered fish is not gluten-free, no matter what the ingredients list says. The same applies to a shared grill and a shared toaster.",
      ],
      bullets: [
        "Wash hands and change gloves before starting an allergen order",
        "Use clean utensils and boards — not the ones you just wiped",
        "Never cook an allergen-free item in shared fryer oil",
        "Prep allergen orders away from the main flow, and cover them",
        "Mark the plate so it cannot be swapped on the pass",
        "Store open ingredients covered and labelled so nothing drips or spills into them",
      ],
      keyPoint:
        "A shared fryer is the single most common way a dish described as free-from stops being free-from.",
    },
    menuLesson(dishes),
    {
      id: "if-it-goes-wrong",
      title: "If it goes wrong",
      body: [
        "If a guest tells you they are having a reaction, treat it as an emergency until proven otherwise. Do not walk them anywhere, do not tell them to get some air, and do not wait to see if it settles. Ask whether they carry adrenaline and help them use it if they ask. Call the emergency number for your country, say the word anaphylaxis, and send somebody to the door to meet the ambulance.",
        "Keep the food, the packaging and the docket. Do not clear the table or scrape the plate — what was actually served becomes the only evidence of what happened.",
        "Then tell a manager immediately and record it. A near miss recorded honestly is how the procedure gets fixed. A near miss buried is how the same thing happens again to somebody less lucky.",
      ],
      bullets: [
        "Treat any suspected reaction as an emergency, immediately",
        "Do not make the person walk or stand",
        "Help them use their own adrenaline auto-injector if they ask",
        "Call emergency services and use the word anaphylaxis",
        "Keep the plate, packaging and docket — do not clear it",
        "Tell a manager and record it the same shift",
      ],
      keyPoint:
        "Keep the food and the docket. Once the plate is scraped, nobody can establish what was actually served.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Quiz
// --------------------------------------------------------------------------- //

function knowledgeBank(): QuizQuestion[] {
  return [
    {
      id: "k-worcester",
      kind: "single",
      prompt: "A guest avoiding fish asks whether the Caesar dressing is safe. What is true?",
      options: [
        "Caesar dressing is fish-free unless anchovy is listed separately",
        "Traditional Caesar dressing and Worcestershire sauce both usually contain anchovy",
        "Only fresh fish counts as an allergen, so dressings are fine",
        "Fish protein is destroyed by the vinegar in the dressing",
      ],
      correct: [1],
      why: "Worcestershire sauce contains anchovy, and traditional Caesar dressing is made with anchovy too. Both are classic hidden-fish items.",
    },
    {
      id: "k-soy-gluten",
      kind: "single",
      prompt: "A guest needs to avoid gluten. Which of these is the most likely to catch you out?",
      options: [
        "Plain rice",
        "Standard soy sauce",
        "Fresh tomatoes",
        "Olive oil",
      ],
      correct: [1],
      why: "Most standard soy sauce is brewed with wheat. It is one of the most common sources of unexpected gluten in a kitchen.",
    },
    {
      id: "k-celery",
      kind: "single",
      prompt: "Which everyday kitchen item most often contains celery?",
      options: ["Stock cubes and bouillon", "Caster sugar", "Rice vinegar", "Baking powder"],
      correct: [0],
      why: "Celery is in most stock cubes, bouillon and mirepoix bases, which is why it turns up in soups and sauces that contain no visible celery.",
    },
    {
      id: "k-fryer",
      kind: "single",
      prompt:
        "The kitchen has one fryer. A guest with coeliac disease orders chips. What is the correct answer?",
      options: [
        "The chips are gluten-free because potatoes contain no gluten",
        "The chips are fine if the oil was changed this week",
        "The chips cannot be treated as gluten-free because the fryer is shared with battered items",
        "The chips are fine as long as they go in a clean basket",
      ],
      correct: [2],
      why: "Shared fryer oil carries gluten from battered and crumbed items. A clean basket and fresh-ish oil do not change that.",
    },
    {
      id: "k-script",
      kind: "single",
      prompt: "A guest says they have an allergy but you are not sure about a dish. What do you do?",
      options: [
        "Say it should be fine — the chef would have mentioned it",
        "Suggest they order it and tell you if they feel unwell",
        "Say you will check, look up the recorded allergen information, and come back with what you confirmed",
        "Recommend the dish with the fewest ingredients",
      ],
      correct: [2],
      why: "Checking and reporting back is the only correct answer. Reassurance offered without checking is how incidents happen.",
    },
    {
      id: "k-nuts",
      kind: "multi",
      prompt: "Which of these statements are true about nuts?",
      note: "Select all that apply.",
      options: [
        "Peanut is a legume and is declared separately from tree nuts",
        "Pine nut is one of the EU named tree nuts",
        "Vegan cheese and cream alternatives are often made from cashew",
        "Pesto can contain cashew or almond as well as pine nut",
      ],
      correct: [0, 2, 3],
      why: "Peanut is a legume declared separately. Pine nut is not on the EU named tree nut list. Vegan dairy alternatives and commercial pesto are both frequent hidden sources of cashew.",
    },
    {
      id: "k-reaction",
      kind: "multi",
      prompt: "A guest appears to be having a serious allergic reaction. Which of these are correct?",
      note: "Select all that apply.",
      options: [
        "Call emergency services and say the word anaphylaxis",
        "Walk them outside for fresh air",
        "Keep the plate, packaging and docket",
        "Help them use their own adrenaline auto-injector if they ask",
      ],
      correct: [0, 2, 3],
      why: "Never make somebody having a reaction walk or stand. Call for help, assist with their own adrenaline if asked, and preserve the food and docket as evidence.",
    },
    {
      id: "k-ask",
      kind: "single",
      prompt: "What is the better opening question when taking an order?",
      options: [
        "\"Any allergies?\"",
        "\"Which allergen is it, so I can check it properly?\"",
        "\"Anything you don't like?\"",
        "\"Is it a serious allergy or just an intolerance?\"",
      ],
      correct: [1],
      why: "Asking which allergen gets you the specific information you need to check. Asking whether it is serious invites the guest to downplay it.",
    },
    {
      id: "k-change",
      kind: "single",
      prompt:
        "The kitchen switches to a cheaper brand of the same sauce. What does that mean for allergen information?",
      options: [
        "Nothing — it is the same product type",
        "The recorded allergens must be re-checked against the new supplier's spec",
        "It only matters if the recipe changes",
        "It only matters for gluten",
      ],
      correct: [1],
      why: "Changing supplier can change the allergens without the recipe looking any different. Recorded information has to be re-checked against the new spec.",
    },
    {
      id: "k-sesame",
      kind: "single",
      prompt: "Which of these is a common hidden source of sesame?",
      options: ["Hummus", "Mashed potato", "Tomato soup", "Plain yoghurt"],
      correct: [0],
      why: "Hummus contains tahini, which is sesame. Burger buns and many artisan breads are the other frequent sources.",
    },
    {
      id: "k-sulphites",
      kind: "single",
      prompt: "Sulphites are most commonly found in which of these?",
      options: ["Fresh milk", "Dried fruit and wine", "Fresh chicken", "Rice"],
      correct: [1],
      why: "Dried fruit, wine and other drinks are the usual sources, along with dehydrated potato products and some sausages.",
    },
    {
      id: "k-milk",
      kind: "single",
      prompt: "A dish is described on the menu as vegetable mash. A guest avoids milk. What should you check?",
      options: [
        "Nothing — vegetables contain no milk",
        "Whether butter, cream or milk was used to finish it",
        "Only whether cheese was added on top",
        "Whether it was cooked in the same pan as a dairy dish",
      ],
      correct: [1],
      why: "Mash and vegetable sides are very often finished with butter or cream. A vegetable description says nothing about dairy.",
    },
  ];
}

/** Questions built from the venue's own confirmed dishes. */
function menuQuestions(dishes: CourseDish[], seed: number): QuizQuestion[] {
  const usable = dishes.filter((d) => d.checked);
  if (usable.length === 0) return [];

  const out: QuizQuestion[] = [];
  const picked = shuffled(usable, seed).slice(0, 4);

  for (const dish of picked) {
    // "Which allergens are recorded" — options are 3 wrong-ish plus the truth.
    const contains = dish.contains;

    if (contains.length > 0) {
      // Multi-select over a candidate set that includes every real one plus decoys.
      const decoys = ALLERGENS.filter((a) => !contains.includes(a.key))
        .map((a) => a.key)
        .slice(0, 20);
      const chosenDecoys = shuffled(decoys, seed + dish.id.length).slice(
        0,
        Math.max(2, 5 - contains.length)
      );
      const optionKeys = shuffled([...contains, ...chosenDecoys], seed + 7);
      const labels = optionKeys.map(
        (k) => ALLERGENS.find((a) => a.key === k)!.label
      );
      out.push({
        id: `m-${dish.id}`,
        kind: "multi",
        prompt: `Which allergens are recorded on your menu for "${dish.name}"?`,
        note: "Select all that apply. This is your own venue's recorded information.",
        options: labels,
        correct: optionKeys
          .map((k, i) => (contains.includes(k) ? i : -1))
          .filter((i) => i >= 0),
        why: `Your recorded information for ${dish.name} lists ${contains
          .map((k) => ALLERGENS.find((a) => a.key === k)!.label)
          .join(", ")}.`,
      });
    } else {
      // Nothing recorded — test the right instinct rather than the list.
      out.push({
        id: `m-${dish.id}`,
        kind: "single",
        prompt: `Your menu records no allergens for "${dish.name}". A guest asks whether it is safe for their allergy. What is the correct response?`,
        options: [
          "Confirm it is safe — nothing is recorded against it",
          "Tell them no allergens are recorded, and check the recipe and supplier specs before confirming",
          "Suggest they try a small amount first",
          "Tell them all dishes may contain everything",
        ],
        correct: [1],
        why: "A blank record is not the same as a confirmed absence. Check the recipe and the supplier spec before you confirm anything.",
      });
    }
  }

  return out;
}

/**
 * Build a paper. Deterministic for a given seed, so the same trainee reloading
 * the page gets the same questions.
 */
export function buildQuiz(
  slug: string,
  data: CourseData,
  seed: number
): QuizQuestion[] {
  if (slug === "fire-safety-awareness") return fireQuiz(data.assets, seed);
  if (slug === "manual-handling-awareness") return manualHandlingQuiz(data.stock, seed);
  if (slug === "food-hygiene-awareness") return foodHygieneQuiz(data.haccp, seed);
  if (slug === "haccp-system-awareness")
    return haccpSystemQuiz(data.haccp, data.haccpChecks, data.haccpLogs, seed);
  if (slug === "cleaning-chemical-safety") return cleaningQuiz(data.cleaning, seed);
  if (slug === "deliveries-goods-in") return deliveriesQuiz(data.deliveries, seed);
  if (slug === "guest-data-privacy") return privacyQuiz(data.customers, seed);
  if (slug === "working-time-breaks")
    return workingTimeQuiz(data.shifts, data.clock, seed);
  if (slug !== "allergen-awareness") return [];

  const fromMenu = menuQuestions(data.dishes, seed);
  // A small menu means fewer venue questions, so top up from the knowledge bank
  // rather than shipping a four-question paper.
  const wanted = 12;
  const knowledge = shuffled(knowledgeBank(), seed).slice(
    0,
    Math.max(6, wanted - fromMenu.length)
  );

  return shuffled([...fromMenu, ...knowledge], seed + 31);
}

/** Strip the answers before anything goes to the browser. */
export function publicQuiz(qs: QuizQuestion[]) {
  return qs.map((q) => ({
    id: q.id,
    kind: q.kind,
    prompt: q.prompt,
    note: q.note,
    options: q.options,
  }));
}

export interface GradedAnswer {
  id: string;
  prompt: string;
  kind: "single" | "multi";
  options: string[];
  given: number[];
  correct: number[];
  right: boolean;
  why: string;
}

export function grade(
  qs: QuizQuestion[],
  given: Record<string, number[]>
): { score: number; total: number; percent: number; detail: GradedAnswer[] } {
  const detail: GradedAnswer[] = qs.map((q) => {
    const g = [...(given[q.id] ?? [])].sort((a, b) => a - b);
    const c = [...q.correct].sort((a, b) => a - b);
    const right = g.length === c.length && g.every((v, i) => v === c[i]);
    return {
      id: q.id,
      prompt: q.prompt,
      kind: q.kind,
      options: q.options,
      given: g,
      correct: c,
      right,
      why: q.why,
    };
  });

  const score = detail.filter((d) => d.right).length;
  const total = detail.length;
  return {
    score,
    total,
    percent: total === 0 ? 0 : Math.round((score / total) * 100),
    detail,
  };
}
