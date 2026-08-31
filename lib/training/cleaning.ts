/**
 * Cleaning & chemical safety awareness — in-house course content.
 *
 * ── What this is ────────────────────────────────────────────────────────────
 * Employer-delivered awareness training on cleaning and on the chemicals a
 * kitchen and bar actually use, built around the venue's own cleaning records.
 * An operator is generally expected to instruct and supervise staff in the
 * hygiene and safety matters appropriate to their work, and to make sure the
 * people using hazardous substances have been told how to use them. Neither of
 * those requires an awarding body.
 *
 * ── What it is NOT ──────────────────────────────────────────────────────────
 * It is NOT a COSHH / chemical safety qualification, not a HACCP Level 1 or 2,
 * not a food safety certificate, and not a substitute for reading the safety
 * data sheet and the label of the specific products this venue buys. Product
 * dilutions and contact times differ per product and per manufacturer, and the
 * legal framework differs per country. Every figure below is stated as a
 * widely used one with a nudge to check the label and the local rule — the
 * label on the bottle in your hand beats any training material, including this.
 *
 * ── Why it reads records and not checklist templates ────────────────────────
 * The obvious build was "your own cleaning checklists". A production survey
 * found that not one venue had ever customised one, so "your checklists" would
 * really have meant "our default checklists handed back to you" — which breaks
 * the rule this whole library is built on: never present invented or generic
 * data as the venue's own. What IS genuinely theirs is what they logged. So the
 * course reads the cleaning records: how much of the list was actually ticked,
 * when the last deep clean was, and whether anybody has ever adapted the list.
 */

import {
  CLEANING_CHECK_TYPES,
  DEFAULT_CLEANING_ITEMS,
  niceDate,
  type CourseCleaningRecord,
  type CourseCleaningTemplate,
  type Lesson,
  type QuizQuestion,
  shuffled,
} from "./kit";

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Newest record of a given type, or undefined. Deterministic — sorted by date. */
function latestOf(records: CourseCleaningRecord[], checkType: string) {
  return records
    .filter((r) => r.checkType === checkType)
    .slice()
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
}

/** Newest record overall, whatever type. */
function latestAny(records: CourseCleaningRecord[]) {
  return records
    .slice()
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
}

/**
 * Whole days between a record and the start of today.
 *
 * Measured from midnight rather than the exact clock so a lesson or a paper
 * rebuilt twenty minutes later during grading reads the same number.
 */
function daysAgo(iso: string): number {
  const then = new Date(iso).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today - then) / 86400000));
}

function agoPhrase(iso: string): string {
  const d = daysAgo(iso);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `about ${Math.round(d / 30)} months ago`;
}

/** The one record that most clearly shows a part-ticked list saved as a pass. */
function bestPartial(records: CourseCleaningRecord[]): CourseCleaningRecord | undefined {
  const partials = records.filter(
    (r) => r.expectedCount > 0 && r.tickedCount < r.expectedCount
  );
  if (partials.length === 0) return undefined;
  // Widest gap first; newest wins a tie. Fully deterministic, no seed needed.
  return partials.slice().sort((a, b) => {
    const ga = a.expectedCount - a.tickedCount;
    const gb = b.expectedCount - b.tickedCount;
    if (ga !== gb) return gb - ga;
    return b.checkedAt.localeCompare(a.checkedAt);
  })[0];
}

// --------------------------------------------------------------------------- //
// The venue's own records
// --------------------------------------------------------------------------- //

/**
 * Lesson one of the venue block: what the venue's own logs actually show.
 *
 * Three states. No records at all is its own lesson and a common one. A set of
 * records where the ticks do not match the list is the sharpest lesson in the
 * whole course. A complete set is praised plainly and then pushed on the one
 * thing a complete set still cannot prove.
 */
export function recordsLesson(records: CourseCleaningRecord[]): Lesson {
  if (records.length === 0) {
    return {
      id: "your-records",
      title: "Your own cleaning records",
      body: [
        "This is normally the most useful lesson in the course, because it is the only part no outside training provider can give you: your own cleaning logs, and what they show about how the cleaning here actually gets done.",
        "Nothing has been logged here yet. That is worth being straight about: it does not mean this kitchen is dirty, and it does not mean anybody is cutting corners. Plenty of well-run venues clean properly and write none of it down.",
        "What it does mean is that there is no way to show it. If somebody asks how often the extraction gets degreased, or whether the closing round was done on the Saturday three weeks ago, the honest answer is that nobody knows. Cleaning that is not recorded is cleaning that only exists for as long as somebody remembers it — and memory is the first thing to go in a busy month.",
        "Logging a checklist under HACCP takes under a minute at the end of a shift. The point of doing it is not the tick. It is that in six months the venue can still show what was done, and can see the one job that keeps getting skipped.",
      ],
      keyPoint:
        "An empty cleaning record is not evidence of a dirty kitchen. It is the absence of evidence of a clean one — and those are treated very differently when something goes wrong.",
    };
  }

  const byType = CLEANING_CHECK_TYPES.map((t) => ({
    type: t,
    label: DEFAULT_CLEANING_ITEMS[t] ? latestOf(records, t)?.label ?? t : t,
    rows: records.filter((r) => r.checkType === t),
    last: latestOf(records, t),
  })).filter((g) => g.rows.length > 0);

  const bullets = byType.map((g) => {
    const last = g.last!;
    const ticks =
      last.expectedCount > 0
        ? `${last.tickedCount} of ${last.expectedCount} tasks ticked`
        : `${last.tickedCount} ${plural(last.tickedCount, "task", "tasks")} ticked`;
    return `${last.label}: ${g.rows.length} ${plural(g.rows.length, "record", "records")}, last logged ${niceDate(last.checkedAt)} (${agoPhrase(last.checkedAt)}) — ${ticks}, saved as "${last.status}"`;
  });

  const partial = bestPartial(records);
  const body = [
    "This is the part no outside training provider can give you: your own cleaning logs, read back to you exactly as they were saved.",
    `There ${records.length === 1 ? "is" : "are"} ${records.length} cleaning ${plural(records.length, "record", "records")} on the system here. Read the list, then answer the questions at the end about it.`,
  ];

  if (partial) {
    body.push(
      `Look at the ticks. Your most recent ${partial.label.toLowerCase()} record listed ${partial.tickedCount} of the ${partial.expectedCount} tasks on the list, and it saved as "${partial.status}". That is the thing worth stopping on. A record is supposed to be evidence of what was done — so a part-ticked list saved as a pass says either that most of the list was skipped, or that it was done and not ticked. Both are a problem, and from the outside nobody can tell which one happened.`
    );
  } else {
    body.push(
      "Every record here has the full list ticked, which is the right shape. The thing a complete record still cannot show is whether each tick was earned — so the honesty of it comes down to the person holding the phone at the end of a long shift. That is you."
    );
  }

  return {
    id: "your-records",
    title: "Your own cleaning records",
    body,
    bullets,
    keyPoint:
      "Tick what you did and leave what you did not. A part-done list logged honestly is useful information. A full list of ticks that did not happen is a false record, and it is worth less than no record at all.",
  };
}

/**
 * Lesson two: the deep clean, which is the job nobody notices going missing.
 *
 * A blank or stale deep-clean history is not an accusation. It is the same
 * shape as the fire course's blank-register lesson — the gap is the lesson.
 */
export function deepCleanLesson(records: CourseCleaningRecord[]): Lesson {
  const deep = latestOf(records, "cleaning_deep");
  const weekly = latestOf(records, "cleaning_weekly");

  const body = [
    "Daily cleaning gets done because the kitchen cannot open without it. The weekly and the deep clean are different: nothing stops working when they are skipped, nobody complains, and the consequences arrive months later all at once.",
    "The deep clean is where the two jobs that actually cause serious damage live. Grease in the extraction system is the reason kitchen fires spread into the rest of the building, and it builds up invisibly above head height where nobody looks. Drains, grease traps and the floor under fixed equipment are where a pest problem starts, and a pest problem is one of the fastest ways a venue gets closed.",
  ];

  if (!deep) {
    body.push(
      "There is no deep clean recorded here at all. Again — that is not proof the kitchen is filthy. It is proof that nobody can show when the extraction was last degreased, and that is the exact question an insurer asks after a fire and an inspector asks on a bad visit. If deep cleans do happen here, they should be logged. If they do not, somebody needs to say so out loud."
    );
  } else {
    const d = daysAgo(deep.checkedAt);
    body.push(
      `The last deep clean recorded here was ${niceDate(deep.checkedAt)} — ${agoPhrase(deep.checkedAt)}. ${
        d > 120
          ? "That is long enough that nobody can honestly say the extraction is clean, whatever the daily records show. Ask a manager when the next one is planned."
          : "Worth knowing the date, and worth knowing who to ask when it is due again."
      }`
    );
  }

  if (!weekly) {
    body.push(
      "There is also no weekly cleaning recorded. The weekly list is the one that covers behind and under the cooking line, the extraction filters, the walk-in walls and the drains — the places that look fine from standing height and are the first thing an inspector kneels down to check."
    );
  }

  body.push(
    "Extraction cleaning in particular is usually a contracted job with a certificate, and the interval expected depends on how heavily the kitchen is used and on local fire and insurance rules — heavy-use kitchens are commonly quoted at every three to six months, light use annually. Do not take that from a training page: check the venue's own insurance terms and the local rule."
  );

  return {
    id: "deep-clean",
    title: "The clean nobody notices going missing",
    body,
    bullets: [
      "Daily: surfaces, equipment, floors, bins, hand-wash stations — every shift",
      "Weekly: behind and under equipment, extraction filters, walk-in, drains, waste area",
      "Deep: full extraction system, grease traps, everything moved, drains jetted, signed off",
      "Grease above head height is the fire risk; grease at floor level is the pest risk",
      "Extraction cleaning usually comes with a certificate — the venue needs to keep it",
    ],
    keyPoint:
      "Nobody notices a missed deep clean until there is a fire, an infestation or an inspection. By then the record of the last twelve months is the only thing that can speak for the kitchen.",
  };
}

/**
 * Lesson three: the list itself.
 *
 * Zero venues in production have ever edited a checklist, which makes this an
 * honest and genuinely useful lesson rather than a scold: the list everybody is
 * working to is a starting list, and it will be missing the one bit of kit that
 * actually causes trouble in this kitchen.
 */
export function checklistLesson(templates: CourseCleaningTemplate[]): Lesson {
  const edited = templates.filter((t) => t.itemCount > 0);

  if (edited.length === 0) {
    return {
      id: "the-list",
      title: "Whose list is it?",
      body: [
        "The cleaning checklists in this app started as a general hospitality list. Nobody here has changed them, so the list being ticked every shift is still that starting list.",
        "That matters because no two kitchens are the same. A starting list has no line for the specific bit of kit that causes trouble here — the chargrill that has to come apart, the ice machine nobody thinks of as food equipment, the coffee group heads, the beer lines, the soft-serve machine, the extraction filter above the fryer. Those are exactly the jobs that get missed, because a job that is not on the list is a job that depends on somebody remembering.",
        "It also matters the other way round: if the list has a line that does not apply here, people learn to tick it anyway. One meaningless tick a day is how a whole checklist turns into scenery.",
        "A manager can edit any of the five lists under HACCP. If you are the person doing the cleaning and there is a job you always do that is not on the list — or a line on the list that makes no sense in this building — say so. You are the only person who knows.",
      ],
      keyPoint:
        "A checklist nobody has adapted is a checklist nobody owns. The jobs that get missed are almost always the ones that were never written down.",
    };
  }

  return {
    id: "the-list",
    title: "Whose list is it?",
    body: [
      "The cleaning checklists here have been adapted for this venue rather than left as the general starting list, which is the right way round — the person who knows what actually needs cleaning in this building is somebody who works in it.",
      "Keep it that way. A list goes stale the moment a new piece of equipment arrives, and the new arrival is exactly the thing that gets missed because it is not written down.",
      "If there is a job you always do that is not on the list, or a line that makes no sense in this building, tell a manager. A line people tick without thinking is worse than no line at all.",
    ],
    bullets: edited.map(
      (t) => `${t.label}: adapted for this venue — ${t.itemCount} ${plural(t.itemCount, "task", "tasks")}`
    ),
    keyPoint:
      "A list is only worth ticking if every line on it means something in this building. Get it changed rather than ticking around it.",
  };
}

// --------------------------------------------------------------------------- //
// Lessons
// --------------------------------------------------------------------------- //

export function cleaningLessons(
  records: CourseCleaningRecord[],
  templates: CourseCleaningTemplate[]
): Lesson[] {
  return [
    {
      id: "why",
      title: "Why this matters",
      body: [
        "Cleaning is the part of hospitality everybody thinks they already know how to do, and it is the part with the widest gap between what looks clean and what is clean. A surface can be spotless and still be carrying enough bacteria off the last job to make somebody ill, and a bottle of something ordinary under the sink can put a member of staff in hospital in about a minute.",
        "There are two separate risks in this one subject and they pull in opposite directions. The food safety risk says clean thoroughly and sanitise properly. The chemical safety risk says the products used to do that are hazardous to the people using them — burns, damaged lungs, wrecked skin, and in the worst case a gas that kills.",
        "This course is in-house awareness training delivered by your employer. It is deliberately not a chemical safety or COSHH qualification and it cannot tell you the right dilution or contact time for the specific products this venue buys. That is on the label and on the safety data sheet, and those beat anything written here.",
      ],
      keyPoint:
        "Clean and safe are two different things, and so are safe-for-the-guest and safe-for-you. This course is about both.",
    },
    {
      id: "products",
      title: "Detergent, sanitiser, disinfectant — they are not the same",
      body: [
        "Three words get used as if they mean one thing, and most cleaning done badly in kitchens comes from that confusion.",
        "Detergent lifts grease, food debris and dirt off a surface. It does not kill anything — it just gets the dirt into the water so it can be rinsed away. Disinfectant and sanitiser kill or reduce micro-organisms, but they cannot work through a layer of grease or food debris. Sanitiser in food premises usually means a product that does both jobs in one bottle, and even then it only does the killing half properly on a surface that is already physically clean.",
        "This is why the sequence is not optional. Spray sanitiser onto a greasy prep bench and wipe it off and you have redistributed the grease and wasted the chemical. Nothing has been killed. The surface looks better than it did, which is the dangerous part.",
        "Whatever the product, it works at the strength the label states and no other. \"More is stronger\" is wrong twice over: a stronger mix does not kill faster than the tested concentration, it leaves residue on food surfaces, and it wrecks the hands of whoever is using it. Weaker is worse in a more obvious way — it simply does not work, and it leaves everybody believing the surface was sanitised.",
      ],
      bullets: [
        "Detergent removes — it does not kill",
        "Disinfectant and sanitiser kill — they cannot work through dirt or grease",
        "Two stages: clean first, then sanitise. Both stages, every time, on food surfaces",
        "Mix at the strength on the label — stronger is not better and it is not safer",
        "Use the right product for the surface: food contact, floors, toilets and glassware are different jobs",
        "A cloth that has been round the whole kitchen spreads more than it removes",
      ],
      keyPoint:
        "Sanitiser on a dirty surface does nothing at all. Clean it first, or do not bother spraying.",
    },
    {
      id: "contact-time",
      title: "Contact time — the most ignored instruction in the building",
      body: [
        "Every disinfectant and sanitiser has a contact time, sometimes called dwell time: the number of minutes the surface has to stay visibly wet with the product for it to do what the label claims. It is on the bottle, and it is the single most widely ignored instruction in hospitality.",
        "Spray, wipe, next — the standard three-second version of the job — gives the chemical almost no time to work. Depending on the product the stated contact time is commonly somewhere between thirty seconds and ten minutes, and it varies enough between products that guessing is pointless. Read the bottle in your own kitchen.",
        "So the practical version is: clean the surface, apply the sanitiser, leave it wet, go and do something else, come back. On a busy line that feels like a delay. It is the difference between the surface being sanitised and the surface being damp.",
        "Two related habits. Do not top up a spray bottle that still has old product in it, and do not mix a fresh batch of dilution into yesterday's — diluted product loses strength and grows its own contamination. And keep food-contact sanitiser off the floor mop and the toilet cloth: cross-using a cloth or a bottle between those areas undoes the entire exercise.",
      ],
      bullets: [
        "Contact time means visibly wet for the time the label states",
        "Wiping it straight off is the most common way cleaning fails",
        "Make dilutions fresh, and do not top up an old bottle",
        "Colour-code cloths and boards, and keep floor kit away from food surfaces",
        "Clean as you go — an end-of-shift blitz gets done badly by tired people",
        "Dishwasher and glasswasher: check the temperature and the detergent level, and clean the machine itself",
      ],
      keyPoint:
        "If the label says leave it two minutes and you wipe it after two seconds, you have cleaned the surface and sanitised nothing.",
    },
    {
      id: "chemicals",
      title: "The chemicals that must never meet",
      body: [
        "This is the part of the course that is about you rather than the guest. Kitchen and bar chemicals are among the most hazardous substances most people ever handle at work, and they are handled in a hurry by people who were never told.",
        "Never mix chlorine bleach with an acid — that includes descaler, limescale remover, many toilet and washroom cleaners, and vinegar. It releases chlorine gas. Bleach mixed with an ammonia-based cleaner, or with urine in a urinal, releases chloramine gas. Both of these have hospitalised and killed hospitality and cleaning workers, in real incidents, in ordinary buildings. It happens in seconds in an enclosed toilet or a small cellar, and the smell arrives after the damage has started.",
        "So the rule is blunt: one product at a time, on a surface that has been rinsed, in a room with the door open. Never combine two cleaners to make something stronger. If a surface needs a second product, rinse first.",
        "Oven and grill cleaner, drain unblocker and descaler are caustic or strongly acidic and will burn skin and eyes on contact — those need gloves and eye protection, and the label will say so. Warm caustic cleaner splashing back out of an oven is a classic hospitality burn.",
        "Never decant a chemical into an unlabelled bottle, and never into a drinks bottle. People have been poisoned drinking cleaning fluid out of a water bottle in a kitchen. Anything decanted gets labelled with what it is, or it does not get decanted.",
        "Every hazardous product has a safety data sheet, and the venue is generally expected to hold them and to make them available. It tells you what the product is, what it does to you, and what to do about a splash or a swallow — including whether making somebody vomit is the right move, which for caustics it is not. Ask a manager where they are kept before you need them.",
      ],
      bullets: [
        "Bleach + acid (descaler, limescale, many toilet cleaners, vinegar) = chlorine gas. Never.",
        "Bleach + ammonia cleaner, or bleach into a urinal = chloramine gas. Never.",
        "One product at a time, rinse between, door open, no improvised mixes",
        "Gloves and eye protection for oven cleaner, drain unblocker and descaler",
        "Never decant into an unlabelled or a drinks bottle",
        "Store chemicals away from and BELOW food, never above it, and never in a food container",
        "Know where the safety data sheets are before there is a splash",
        "Repeated exposure wrecks skin — dermatitis is the most common occupational disease in this trade",
      ],
      keyPoint:
        "Two cleaners mixed together in a small toilet or a cellar can produce a gas that kills. There is no version of the job that is worth that.",
    },
    {
      id: "slips-and-waste",
      title: "Wet floors, waste and the rest of the shift",
      body: [
        "Slips and trips are consistently one of the largest causes of workplace injury in hospitality, and cleaning is when most of them happen — the floor is wet because somebody is doing the right thing, and the sign is still in the cupboard.",
        "Put the sign out before the mop touches the floor, not after. Mop in sections so there is always a dry route, deal with a spill the moment you see it rather than stepping around it, and say something out loud when you are working behind somebody carrying a tray. A wet floor sign left out permanently is not a safety measure — people stop seeing it.",
        "Waste is the other half of this. Bags get lifted with broken glass and knives in them, so nothing sharp goes in a soft bag, and nobody presses a bag down with their hand or their foot. Bins get closed, the waste area gets cleaned rather than just emptied, and cardboard is not left stacked against the building — that is both a fire load and a pest hotel.",
        "And the boring one that actually protects you: wash your hands after cleaning, before you touch food. Cleaning is a dirty job and chemicals belong on surfaces, not in a dish.",
      ],
      bullets: [
        "Sign out before the mop goes down, and taken in when the floor is dry",
        "Mop in sections, leave a dry route, deal with spills immediately",
        "No sharps or glass in soft bags, and never press a bag down",
        "Clean the waste area, do not just empty it — pests and fire load",
        "Gloves for cleaning, and hands washed afterwards before touching food",
        "Report a broken mop head, a missing sign, an empty soap dispenser — it is not somebody else's job",
      ],
      keyPoint:
        "The wet floor sign goes out first. Almost every cleaning injury in hospitality is somebody walking onto a floor they did not know was wet.",
    },
    recordsLesson(records),
    deepCleanLesson(records),
    checklistLesson(templates),
    {
      id: "records",
      title: "The record is the proof",
      body: [
        "Nobody can go back and inspect last Tuesday's kitchen. The record of last Tuesday is the only version of it that exists, which is why a cleaning log carries weight out of all proportion to the ten seconds it takes to fill in.",
        "Tick what was done, leave what was not, and add a note when something got skipped and why. A log with an honest gap and a line saying \"drains not done, no jetting kit, told the chef\" is a venue managing itself. A log with nothing but full ticks, in a kitchen where the extraction has visible grease on it, is a venue with a problem and a record that makes it look worse.",
        "Sign your own checks and nobody else's. And if the list is wrong for this building, get the list changed rather than ticking around it.",
        "This course itself is a record. Passing it files an in-house training record against your name, valid for twelve months, and the app will chase the retrain when it is due. It is proof your employer instructed you — deliberately not an accredited chemical safety or food safety qualification, and it does not pretend to be one.",
      ],
      keyPoint:
        "Log it at the time, under your own name, honestly. The only cleaning record worth having is one somebody could check.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Knowledge questions
// --------------------------------------------------------------------------- //

export function cleaningBank(): QuizQuestion[] {
  return [
    {
      id: "c-twostage",
      kind: "single",
      prompt:
        "A prep bench has grease and food debris on it. What is the correct way to get it food-safe?",
      options: [
        "Spray sanitiser over it and wipe it off",
        "Clean it with detergent first, then apply sanitiser and leave it the contact time",
        "Hot water and a cloth — sanitiser is only for chopping boards",
        "Sanitise it, then clean off the residue with detergent",
      ],
      correct: [1],
      why: "Two stages, in that order. Sanitiser cannot work through grease or debris, so spraying a dirty surface redistributes the dirt and kills nothing — while making the bench look better than it did.",
    },
    {
      id: "c-detergent",
      kind: "single",
      prompt: "What does detergent actually do?",
      options: [
        "Kills bacteria on contact",
        "Lifts grease and dirt off the surface so it can be rinsed away",
        "Both cleans and disinfects in one step",
        "Neutralises chemical residue",
      ],
      correct: [1],
      why: "Detergent removes; it does not kill. That is the whole reason a second, sanitising step exists.",
    },
    {
      id: "c-contact",
      kind: "single",
      prompt: "What does the contact time on a sanitiser bottle mean?",
      options: [
        "How long the bottle lasts once opened",
        "How long you should scrub for",
        "How long the surface has to stay visibly wet with the product for it to work",
        "How long to wait before the surface can be used again",
      ],
      correct: [2],
      why: "Visibly wet, for the time the label states. Spray-wipe-next gives the chemical almost no time to work — it is the most commonly ignored instruction in the building.",
    },
    {
      id: "c-dilution",
      kind: "single",
      prompt: "The label says 20ml per litre. Would a stronger mix be better?",
      options: [
        "Yes — stronger kills faster and more thoroughly",
        "Yes, on food surfaces, as long as it is rinsed",
        "No — it does not work better, it leaves residue on food surfaces and it damages your skin",
        "It makes no difference either way",
      ],
      correct: [2],
      why: "Products are tested at a stated concentration. Stronger does not kill faster, it leaves residue where food goes, and it wrecks the hands of whoever is using it.",
    },
    {
      id: "c-bleach-acid",
      kind: "single",
      prompt:
        "The toilet is limescaled. Bleach has not shifted it, so somebody suggests adding descaler on top. What do you do?",
      options: [
        "Add the descaler — two products will work better than one",
        "Add the descaler but open the window first",
        "Refuse: bleach and an acid together release chlorine gas. Rinse thoroughly, then use one product only",
        "Mix them in a bucket first so it is diluted",
      ],
      correct: [2],
      why: "Bleach plus an acid — descaler, limescale remover, many washroom cleaners, vinegar — releases chlorine gas. In a small enclosed toilet that has hospitalised and killed cleaning workers. One product at a time, rinse between.",
    },
    {
      id: "c-ammonia",
      kind: "multi",
      prompt: "Which of these combinations must never be mixed?",
      note: "Select all that apply.",
      options: [
        "Chlorine bleach and a limescale descaler",
        "Chlorine bleach and an ammonia-based glass cleaner",
        "Detergent and warm water",
        "Bleach poured into a urinal",
      ],
      correct: [0, 1, 3],
      why: "Bleach with acid gives chlorine gas; bleach with ammonia — or with urine in a urinal — gives chloramine gas. Detergent and warm water is just washing up.",
    },
    {
      id: "c-decant",
      kind: "single",
      prompt:
        "You need to carry some degreaser to the other end of the kitchen and the only spare container is an empty soft drink bottle. What do you do?",
      options: [
        "Use it — you will be back in five minutes",
        "Use it and tell the person next to you",
        "Do not use it. Chemicals go in a proper labelled container, never a drinks bottle",
        "Use it but pour the rest away afterwards",
      ],
      correct: [2],
      why: "People have been poisoned drinking cleaning fluid from a bottle in a kitchen. Anything decanted gets a proper labelled container, and never a food or drinks one.",
    },
    {
      id: "c-storage",
      kind: "single",
      prompt: "Where should cleaning chemicals be stored?",
      options: [
        "On the shelf above the prep bench, where they are handy",
        "In a designated place away from food, and below it rather than above it",
        "Anywhere dry, as long as the lids are on",
        "In the dry store with the ingredients",
      ],
      correct: [1],
      why: "Away from food and below it, so a leak or a knocked bottle cannot get into anything. Never above food, never in a food container, never in the same space as ingredients.",
    },
    {
      id: "c-sds",
      kind: "single",
      prompt: "What is a safety data sheet, and when do you want to know where they are?",
      options: [
        "A delivery docket for chemical orders — the office keeps it",
        "The sheet listing what a product is, what it does to you, and what to do about a splash or a swallow — before you need it",
        "The dilution chart on the wall",
        "A form you fill in after an accident",
      ],
      correct: [1],
      why: "It tells you the hazards and the first-aid response, including whether making somebody vomit is the right move — for caustics it is not. Ask where they are kept before there is a splash, not after.",
    },
    {
      id: "c-ppe",
      kind: "single",
      prompt: "You are about to use oven cleaner on a cooled combi oven. What do you need?",
      options: [
        "Nothing special — it is only oven cleaner",
        "Gloves, eye protection, and the label read before you start",
        "A mask only",
        "Gloves, and to work fast so it does not sit on your skin",
      ],
      correct: [1],
      why: "Oven and grill cleaner is caustic and will burn skin and eyes. Gloves and eye protection, and the label tells you what else — caustic splashing back out of an oven is a classic hospitality burn.",
    },
    {
      id: "c-dermatitis",
      kind: "single",
      prompt:
        "Your hands have been cracked and sore for a fortnight since you started doing the closing clean. What is happening and what should you do?",
      options: [
        "Normal for kitchen work — put cream on it",
        "It is likely occupational dermatitis from repeated exposure. Tell a manager, use gloves, and get it looked at",
        "It means the sanitiser is too weak",
        "Wash less often",
      ],
      correct: [1],
      why: "Dermatitis is the most common occupational disease in this trade, it gets worse with continued exposure, and broken skin on a food handler is a hygiene problem as well as a personal one. Report it early — it is far easier to fix at that stage.",
    },
    {
      id: "c-cloths",
      kind: "single",
      prompt:
        "One cloth has been used on the prep bench, the fridge handles, the bin lid and the floor by the door. What is wrong with that?",
      options: [
        "Nothing, as long as sanitiser was used",
        "It spreads contamination between areas — it is moving dirt around rather than removing it",
        "Only the bin lid matters",
        "It is fine if the cloth is rinsed between each one",
      ],
      correct: [1],
      why: "A cloth that has been round the whole kitchen distributes more than it removes. Separate or colour-coded cloths, changed often, and floor kit kept away from food surfaces.",
    },
    {
      id: "c-wetfloor",
      kind: "single",
      prompt: "When does the wet floor sign go out?",
      options: [
        "After mopping, so people know the floor is drying",
        "Before the mop touches the floor",
        "Only if the public can walk through",
        "Only for large spills",
      ],
      correct: [1],
      why: "Before. Slips are one of the biggest causes of injury in hospitality and nearly all of them are somebody walking onto a floor they did not know was wet. Mop in sections and leave a dry route.",
    },
    {
      id: "c-spill",
      kind: "single",
      prompt:
        "You are carrying plates through and there is oil on the floor by the fryer. What do you do?",
      options: [
        "Step around it and mention it at the end of service",
        "Deal with it now, or stand there and stop anybody walking into it until somebody can",
        "Throw salt on it and carry on",
        "Leave it — the closing clean will get it",
      ],
      correct: [1],
      why: "An oil spill by a fryer is the highest-consequence slip in the building — a fall into hot equipment. It gets dealt with immediately, not added to a list.",
    },
    {
      id: "c-waste",
      kind: "multi",
      prompt: "Which of these are correct about waste?",
      note: "Select all that apply.",
      options: [
        "Broken glass and sharps do not go into a soft bin bag",
        "Press the bag down with your foot to fit more in",
        "The waste area gets cleaned, not just emptied",
        "Stacking cardboard against the outside wall is fine if it is dry",
      ],
      correct: [0, 2],
      why: "Pressing a bag down is how people get cut by what is inside it. Cardboard stacked against the building is both a fire load and a pest habitat, and the waste area itself has to be cleaned or it becomes the pest problem.",
    },
    {
      id: "c-handwash",
      kind: "single",
      prompt: "You have just finished the closing clean and you are asked to plate up a staff meal. What first?",
      options: [
        "Nothing — you were wearing gloves",
        "Wash your hands properly, gloves or not",
        "Rinse your hands under the tap",
        "Change your apron",
      ],
      correct: [1],
      why: "Cleaning is a dirty job and chemicals belong on surfaces, not in food. Gloves do not change the need to wash — a gloved hand picks up everything a bare one does.",
    },
    {
      id: "c-dishwasher",
      kind: "single",
      prompt: "What does a dishwasher or glasswasher need beyond being loaded and switched on?",
      options: [
        "Nothing — the machine does the work",
        "Detergent and rinse aid levels checked, temperature checked, and the machine itself cleaned including filters and jets",
        "A rinse cycle at the end of the night",
        "Descaling once a year",
      ],
      correct: [1],
      why: "A machine running cold or out of detergent produces warm wet crockery and nothing else, and a filthy filter recirculates debris. Chemical levels, temperature, and cleaning the machine itself.",
    },
    {
      id: "c-cleanasyougo",
      kind: "single",
      prompt: "Why is clean-as-you-go preferred over one blitz at the end of the shift?",
      options: [
        "It is not — an end-of-shift blitz is more thorough",
        "Because dirt is easier to remove before it dries on, and tired people at the end of a shift do the job badly",
        "Because it saves chemical",
        "Because it means the closing checklist can be skipped",
      ],
      correct: [1],
      why: "Baked-on and dried-on soil takes far longer to shift, and a pile of cleaning left to the last twenty minutes of a fourteen-hour day gets done to whatever standard is fastest.",
    },
    {
      id: "c-record",
      kind: "single",
      prompt:
        "The closing clean got half done because the last table stayed until one in the morning. What goes on the record?",
      options: [
        "Tick the full list — it will be done properly tomorrow",
        "Tick what was actually done, note what was not and why, and tell a manager",
        "Log nothing at all",
        "Tick the full list and mention it verbally",
      ],
      correct: [1],
      why: "A part-done list logged honestly with a note is useful information a manager can act on. A full set of ticks that did not happen is a false record, and it makes every honest entry beside it worthless.",
    },
    {
      id: "c-extraction",
      kind: "single",
      prompt: "Why does grease in the extraction system matter more than grease anywhere else?",
      options: [
        "It smells",
        "It is the reason kitchen fires spread into the rest of the building, and it builds up where nobody looks",
        "It slows the fan down",
        "It only matters for the annual inspection",
      ],
      correct: [1],
      why: "Extraction ductwork carries fire through a building, and the grease that feeds it accumulates invisibly above head height. It is usually a contracted job with a certificate the venue has to keep.",
    },
    {
      id: "c-lookclean",
      kind: "single",
      prompt: "A stainless steel surface looks spotless. What does that tell you?",
      options: [
        "It is clean and safe to prep on",
        "It is visually clean — which says nothing about whether it was sanitised",
        "It was sanitised recently",
        "It only needs a rinse",
      ],
      correct: [1],
      why: "Visually clean and microbiologically safe are different things. That is the entire reason the two-stage process and the contact time exist.",
    },
    {
      id: "c-mixing",
      kind: "single",
      prompt: "A spray bottle of sanitiser is nearly empty. What is the right thing to do?",
      options: [
        "Top it up with fresh dilution on top of the old",
        "Empty it, rinse it, and make a fresh dilution at the strength on the label",
        "Add a splash of neat product to make the rest last",
        "Add water to stretch it out",
      ],
      correct: [1],
      why: "Diluted product loses strength over time and can grow its own contamination. Fresh dilution in a clean bottle, at label strength — and never neat product added to make it \"stronger\".",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Questions built from the venue's own records
// --------------------------------------------------------------------------- //

/**
 * Venue questions.
 *
 * Everything here is derived from records the venue actually saved. Nothing is
 * invented: no records at all becomes a question about what an empty log means,
 * which is the honest lesson for that venue rather than a quiz about fictional
 * cleaning.
 */
export function cleaningQuestions(
  records: CourseCleaningRecord[],
  seed: number
): QuizQuestion[] {
  if (records.length === 0) {
    return [
      {
        id: "c-empty",
        kind: "single",
        prompt:
          "No cleaning checklists have ever been logged here. What does that empty record actually prove?",
        options: [
          "That the kitchen is not being cleaned",
          "Nothing about how clean the kitchen is — but it means nobody can show what was done or when",
          "Nothing at all, so it does not matter",
          "That the checklists are not required for this venue",
        ],
        correct: [1],
        why: "An empty log is not evidence of a dirty kitchen. It is the absence of evidence of a clean one — and if somebody asks when the extraction was last degreased, nobody can answer.",
      },
      {
        id: "c-empty-why",
        kind: "single",
        prompt:
          "Cleaning here gets done but does not get logged. Why is the log worth the minute it takes?",
        options: [
          "Because a tick is what an inspector wants to see",
          "Because in six months it is the only thing that can show what was done, and it shows which job keeps getting skipped",
          "Because it makes the cleaning itself more thorough",
          "It is not worth it if the cleaning is being done anyway",
        ],
        correct: [1],
        why: "Nobody can go back and inspect last Tuesday. The record is the only version of last Tuesday that exists, and reading it back is how a venue spots the job that never gets done.",
      },
    ];
  }

  const out: QuizQuestion[] = [];

  // 1. The sharpest lesson available: a part-ticked list saved as a pass.
  const partial = bestPartial(records);
  if (partial) {
    out.push({
      id: `c-partial-${partial.id}`,
      kind: "single",
      prompt: `Your most recent ${partial.label.toLowerCase()} record listed ${partial.tickedCount} of the ${partial.expectedCount} tasks on the list, and it saved as "${partial.status}". What does that record tell somebody reading it back?`,
      note: "This is your own venue's recorded data.",
      options: [
        `That the ${partial.label.toLowerCase()} was completed`,
        "That either most of the list was skipped, or it was done and not ticked — and nobody can tell which",
        "Nothing — the status is what counts",
        "That the list is too long",
      ],
      correct: [1],
      why: `A record is evidence of what was done. ${partial.tickedCount} of ${partial.expectedCount} ticked and saved as a pass leaves a reader unable to tell a skipped list from a badly filled-in one, and both are a problem worth fixing.`,
    });
  } else {
    const newest = latestAny(records)!;
    out.push({
      id: `c-full-${newest.id}`,
      kind: "single",
      prompt: `Your cleaning records here have the full list ticked, including the ${newest.label.toLowerCase()} logged ${niceDate(newest.checkedAt)}. What can a complete record still not show?`,
      note: "This is your own venue's recorded data.",
      options: [
        "Nothing — a full set of ticks proves the cleaning was done",
        "Whether each tick was actually earned, which comes down to the honesty of whoever filled it in",
        "Which member of staff logged it",
        "Whether the products were in date",
      ],
      correct: [1],
      why: "A full set of ticks is the right shape, and it is only worth what the person filling it in made it worth. That is why an honest gap with a note beats an invented tick every time.",
    });
  }

  // 2. The deep clean — the gap nobody notices, or the date they should know.
  const deep = latestOf(records, "cleaning_deep");
  if (!deep) {
    out.push({
      id: "c-nodeep",
      kind: "single",
      prompt:
        "There is no deep clean recorded here at all. Which of these is the correct reading of that?",
      note: "This is your own venue's recorded data.",
      options: [
        "The kitchen must be filthy",
        "It proves nothing about how clean the kitchen is, but it means nobody can show when the extraction was last degreased",
        "Deep cleans are only needed if the daily records show problems",
        "The daily records cover it",
      ],
      correct: [1],
      why: "A blank deep-clean history is not an accusation, it is a gap in the evidence — and \"when was the extraction last cleaned?\" is exactly what an insurer asks after a fire.",
    });
  } else {
    out.push({
      id: `c-deep-${deep.id}`,
      kind: "single",
      prompt: `Your last recorded deep clean was ${niceDate(deep.checkedAt)}. Which jobs is that record supposed to cover?`,
      note: "This is your own venue's recorded data.",
      options: [
        "Surfaces, floors and bins at the end of each shift",
        "Full extraction system, grease traps, everything moved and cleaned behind, drains jetted",
        "Fridge temperatures and date labels",
        "Glassware and crockery",
      ],
      correct: [1],
      why: "The deep clean is where the two jobs that actually cause serious damage live — grease in the extraction, which spreads fire, and drains and floor voids, where a pest problem starts.",
    });
  }

  // 3. A real gap in one of the five lists, when there genuinely is one.
  const missingTypes = CLEANING_CHECK_TYPES.filter(
    (t) => !records.some((r) => r.checkType === t)
  );
  if (missingTypes.length > 0 && records.length > 0) {
    const pick = shuffled([...missingTypes], seed + 7)[0];
    const label =
      pick === "cleaning_weekly"
        ? "weekly cleaning"
        : pick === "cleaning_deep"
          ? "deep clean"
          : pick === "cleaning_daily"
            ? "daily cleaning"
            : pick === "opening_checks"
              ? "opening checks"
              : "closing checks";
    out.push({
      id: `c-missing-${pick}`,
      kind: "single",
      prompt: `Your venue logs some cleaning checklists but has never logged the ${label}. What is the right response to that?`,
      note: "This is your own venue's recorded data.",
      options: [
        "Nothing — the checklists that are being logged are enough",
        "Say something: either that list is being done and not recorded, or it is not being done, and both need a manager to know",
        "Log it retrospectively so the record is complete",
        "Wait until an inspection asks about it",
      ],
      correct: [1],
      why: "A list nobody has ever logged is either invisible work or missing work. Backfilling it afterwards is a false record — the honest move is to tell somebody now.",
    });
  }

  // 4. When the whole log has gone quiet, that is its own question.
  const newest = latestAny(records)!;
  if (daysAgo(newest.checkedAt) > 30) {
    out.push({
      id: `c-stale-${newest.id}`,
      kind: "single",
      prompt: `The most recent cleaning record here is from ${niceDate(newest.checkedAt)} — ${agoPhrase(newest.checkedAt)}. What does the gap since then mean?`,
      note: "This is your own venue's recorded data.",
      options: [
        "Cleaning stopped happening on that date",
        "The cleaning has almost certainly carried on, but there is no record of any of it since then",
        "The records were deleted",
        "Nothing — old records still count",
      ],
      correct: [1],
      why: "A log that stops does not mean the cleaning stopped. It means everything since that date is undocumented, so none of it can be shown to anybody who asks.",
    });
  }

  return out;
}

// --------------------------------------------------------------------------- //
// Paper
// --------------------------------------------------------------------------- //

/**
 * Build the paper. Venue questions first, topped up from the knowledge bank.
 *
 * The floor of 8 knowledge questions means a venue with a long cleaning history
 * still gets a course about cleaning and chemical safety rather than a quiz
 * about its own paperwork.
 */
export function cleaningQuiz(records: CourseCleaningRecord[], seed: number): QuizQuestion[] {
  const fromRecords = cleaningQuestions(records, seed);
  const wanted = 12;
  const knowledge = shuffled(cleaningBank(), seed).slice(
    0,
    Math.max(8, wanted - fromRecords.length)
  );
  return shuffled([...fromRecords, ...knowledge], seed + 31);
}
