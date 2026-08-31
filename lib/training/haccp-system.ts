/**
 * Your food safety management system (HACCP) — in-house course content.
 *
 * READ THIS BEFORE EDITING. This is the single most dangerous course in the
 * folder to get wrong, because "HACCP training" has an accredited meaning.
 *
 * In Ireland the accredited article is QQI Level 1/2/3 Food Safety (HACCP), and
 * Rotahr venues store those as real TrainingCertification rows with
 * certCategory "HACCP". This course is NOT that and must never be titled,
 * summarised, badged or certified as if it were. It is employer-delivered
 * awareness training about the venue's OWN food safety management system, it
 * files as certCategory "OTHER" like every other in-house course, and its copy
 * says on its face that it does not replace an accredited qualification. If a
 * later edit is tempted to call this "HACCP Level 1", stop.
 *
 * Scope, and why it does not duplicate food-hygiene-awareness:
 *   food-hygiene-awareness teaches the PRACTICE — the danger zone, the four Cs,
 *   fitness to work, probes, use-by, and the actual temperature numbers.
 *   This course teaches the SYSTEM above it — what a food safety management
 *   system is, the seven Codex principles, hazard analysis, why a step becomes
 *   a critical control point, critical limit versus target, monitoring,
 *   corrective action, verification and review.
 * So this file deliberately does not restate the temperature figures. Where a
 * number is unavoidable it is framed as "your own documented limit", which is
 * both safer and the correct answer under a HACCP system anyway.
 *
 * Legal framing, hedged everywhere:
 *   - The seven principles come from Codex Alimentarius and are near-universal.
 *   - EU: Regulation (EC) 852/2004 Article 5 requires food business operators to
 *     put in place permanent procedures based on the HACCP principles. Ireland
 *     enforces through the FSAI and its official agencies.
 *   - UK: the Food Safety and Hygiene (England) Regulations 2013 and the
 *     equivalents in Scotland, Wales and Northern Ireland, with Safer Food
 *     Better Business as the small-business route.
 *   - US: the FDA Food Code, plus preventive-control rules under FSMA which are
 *     HACCP-like but not always called HACCP; full HACCP is mandatory only for
 *     some sectors such as seafood, juice and meat.
 * Never let an edit state one of these flatly as "the law says".
 *
 * The venue data this course reads is the equipment register, the monitoring
 * schedule and the logged checks. Equipment names and supplier names are the
 * venue's own property and are safe to print. Who logged a check is NEVER read
 * — see CourseHaccpLog in kit.ts. A course page is opened by every colleague
 * and the reading is frozen into the stored completion snapshot forever, so
 * "Tommy passed a fridge at 8°C" would be issuing a disciplinary, not teaching.
 */

import {
  type CourseHaccpCheck,
  type CourseHaccpLog,
  type CourseHaccpUnit,
  type Lesson,
  type QuizQuestion,
  shuffled,
} from "./kit";

// --------------------------------------------------------------------------- //
// Small helpers
// --------------------------------------------------------------------------- //

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function daysAgo(iso: string): number {
  const then = new Date(iso);
  then.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - then.getTime()) / 86400000);
}

function agoPhrase(iso: string): string {
  const d = daysAgo(iso);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

/** "Main Walk-In Fridge, Bar Fridge and 2 others" */
function nameList(names: string[], max = 3): string {
  const clean = names.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length <= max) {
    if (clean.length === 1) return clean[0];
    return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
  }
  const rest = clean.length - max;
  return `${clean.slice(0, max).join(", ")} and ${rest} ${plural(rest, "other", "others")}`;
}

/** Records that are not a pass. The module writes "pass" | "fail". */
function failures(logs: CourseHaccpLog[]): CourseHaccpLog[] {
  return logs.filter((l) => l.status && l.status.toLowerCase() !== "pass");
}

function correctiveActions(logs: CourseHaccpLog[]): CourseHaccpLog[] {
  return logs.filter((l) => l.checkType === "corrective_action");
}

/** How many distinct days the log covers, and the newest entry. */
function logWindow(logs: CourseHaccpLog[]): {
  days: number;
  newest: string | null;
  oldest: string | null;
} {
  if (logs.length === 0) return { days: 0, newest: null, oldest: null };
  const sorted = [...logs].sort(
    (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime()
  );
  const oldest = sorted[0].checkedAt;
  const newest = sorted[sorted.length - 1].checkedAt;
  const days = new Set(sorted.map((l) => l.checkedAt.slice(0, 10))).size;
  return { days, newest, oldest };
}

// --------------------------------------------------------------------------- //
// Venue lesson 1 — your own critical limits, from your own equipment register
// --------------------------------------------------------------------------- //

export function limitsLesson(units: CourseHaccpUnit[]): Lesson {
  if (units.length === 0) {
    return {
      id: "your-limits",
      title: "Your own critical limits",
      body: [
        "There are no monitored units on this venue's equipment register yet, so this course cannot show you your own critical limits. That is worth pausing on rather than skipping past.",
        "A food safety management system is built on named units with a documented limit each. Not 'the fridges' — this fridge, this cold room, this hot-holding counter, each with the range it must stay inside and a record proving somebody looked. Until the units are named, there is nothing for a monitoring record to point at, and an inspector has nothing to read except a general assurance that things are fine.",
        "Everything else in this course still applies. Add your fridges, freezers and hot-holding units under HACCP → Equipment and this lesson fills itself in with your own kit the next time somebody takes the course.",
      ],
      keyPoint:
        "A limit that is not written against a named unit is not a critical limit. It is an intention.",
    };
  }

  const byType = new Map<string, CourseHaccpUnit[]>();
  for (const u of units) {
    const list = byType.get(u.typeLabel) ?? [];
    list.push(u);
    byType.set(u.typeLabel, list);
  }

  const body: string[] = [
    `This venue has ${units.length} monitored ${plural(units.length, "unit", "units")} on its register. Those units, and the range recorded against each one, are your critical limits. They are not Rotahr's numbers and they are not a textbook's numbers — they are the figures your own system will be judged against.`,
  ];

  const bullets: string[] = [];
  for (const [label, list] of byType) {
    const target = list[0].target;
    bullets.push(
      `${label} — ${list.length} ${plural(list.length, "unit", "units")}, target ${target}: ${nameList(list.map((u) => u.name))}`
    );
  }

  body.push(
    "Read your own list above and notice two things. First, the target range is tighter than the maximum you will find quoted as the legal figure in most countries — that is deliberate, because a unit sitting exactly on the limit has nowhere left to go on a hot Saturday with the door opening every ninety seconds. Second, the limit belongs to the unit, not to the person checking it. Whoever is on shift reads the same number and passes or fails against the same range."
  );
  body.push(
    "If a unit on that list no longer exists, or a new one has been installed and is not on it, the system is already out of date. Reviewing the register when the kit changes is principle seven, and it is the principle venues forget."
  );

  return {
    id: "your-limits",
    title: "Your own critical limits",
    body,
    bullets,
    keyPoint:
      "Your critical limits are the ranges recorded against your own named units — not a figure somebody remembers from a course.",
  };
}

// --------------------------------------------------------------------------- //
// Venue lesson 2 — your own monitoring plan, from your own schedule
// --------------------------------------------------------------------------- //

export function monitoringLesson(checks: CourseHaccpCheck[]): Lesson {
  const active = checks.filter((c) => c.active);

  if (active.length === 0) {
    return {
      id: "your-monitoring",
      title: "Your own monitoring plan",
      body: [
        "This venue has no scheduled checks set up. Checks can still be logged at any time, and they may well be getting logged — but nothing is telling anyone when.",
        "That is the difference between a plan and a habit. A habit lives in the head of whoever normally opens up. It works right up until that person is on holiday, out sick, or has left, and then it quietly stops, and nobody notices until an inspector asks to see six weeks of records that do not exist.",
        "Principle four asks who monitors what, when and how. The 'when' is the part a schedule answers. Set your check times under HACCP → Schedule and Rotahr will prompt whoever is on shift instead of relying on somebody remembering.",
      ],
      keyPoint:
        "Monitoring that depends on one person remembering is not monitoring. It is luck with a good track record.",
    };
  }

  const bullets = active.map((c) => {
    const when =
      c.times.length > 0
        ? `at ${c.times.join(", ")}`
        : "no times set — reminder will not fire";
    const days =
      c.daysOfWeek.length === 0
        ? "every day"
        : `${c.daysOfWeek.length} ${plural(c.daysOfWeek.length, "day", "days")} a week`;
    return `${c.label} — ${when}, ${days}`;
  });

  const totalPrompts = active.reduce(
    (n, c) => n + Math.max(c.times.length, 0) * (c.daysOfWeek.length === 0 ? 7 : c.daysOfWeek.length),
    0
  );

  const body: string[] = [
    `This is your own monitoring plan — ${active.length} scheduled ${plural(active.length, "check", "checks")}, set by this venue, not by Rotahr.`,
  ];

  body.push(
    totalPrompts > 0
      ? `Across a full week that is roughly ${totalPrompts} prompts. Each one is a moment where somebody on shift is asked to look at a unit and write down what they saw. That is principle four in practice, and it is the only part of the system that produces evidence on its own.`
      : "Some of those checks have no times set, so no reminder will fire for them. A scheduled check with no time is a line in a document, not a prompt on somebody's phone."
  );
  body.push(
    "Two things worth knowing about your own plan. A check logged outside its scheduled time still counts — the schedule is a prompt, not a deadline that voids the record. And a check that is prompted and never logged leaves a hole that is visible in your own log, which is exactly what an inspector reads first."
  );

  return {
    id: "your-monitoring",
    title: "Your own monitoring plan",
    body,
    bullets,
    keyPoint:
      "The schedule is who-what-when-how made concrete. If a check is not on it, nobody is being asked.",
  };
}

// --------------------------------------------------------------------------- //
// Venue lesson 3 — your own log, including the gaps in it
// --------------------------------------------------------------------------- //

export function logLesson(logs: CourseHaccpLog[]): Lesson {
  if (logs.length === 0) {
    return {
      id: "your-log",
      title: "What your own log says",
      body: [
        "There are no logged checks for this venue yet, so there is no record for this lesson to read.",
        "Worth being blunt about what that means. Under a HACCP-based system the record is not admin that happens after the real work — the record IS the work, as far as anybody outside the kitchen can ever tell. A venue that monitors diligently and writes nothing down is, on inspection, indistinguishable from a venue that monitors nothing at all. There is no way to prove the difference after the fact.",
        "Start logging under HACCP and this lesson will read back your own history — how far it stretches, what failed, and what happened next.",
      ],
      keyPoint:
        "An unrecorded check cannot be proven to have happened. On paper it did not.",
    };
  }

  const win = logWindow(logs);
  const fails = failures(logs);
  const ca = correctiveActions(logs);
  const withNotes = logs.filter((l) => l.hasNotes);

  const byType = new Map<string, number>();
  for (const l of logs) byType.set(l.label, (byType.get(l.label) ?? 0) + 1);
  const topTypes = [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const body: string[] = [
    `This venue has ${logs.length} logged ${plural(logs.length, "check", "checks")} across ${win.days} ${plural(win.days, "day", "days")}. The most recent was ${win.newest ? agoPhrase(win.newest) : "unknown"}${win.oldest ? `, and the oldest ${agoPhrase(win.oldest)}` : ""}.`,
  ];

  const bullets = topTypes.map(([label, n]) => `${label} — ${n} logged`);

  if (win.newest && daysAgo(win.newest) >= 7) {
    body.push(
      `The newest entry in your log is ${agoPhrase(win.newest)}. A gap that size is the first thing an inspector notices, because it is visible without reading a single temperature. Whatever happened in that window, the log says nothing happened at all.`
    );
  } else {
    body.push(
      "The log is current, which is the hard part and worth saying out loud. Consistency is what makes the rest of the system believable."
    );
  }

  if (fails.length === 0) {
    body.push(
      "Every logged check on this venue's record is a pass. That is either very good news or a warning sign, and only you know which. A log with no failure in it for months sometimes means a well-run kitchen. It sometimes means people are recording the number they expect rather than the number on the probe, or quietly re-checking until it passes. A system that never catches anything is not proof that nothing goes wrong."
    );
  } else {
    body.push(
      `${fails.length} of those ${plural(fails.length, "check", "checks")} did not pass. That is the system working — a failure in the log is not a black mark, it is the evidence that monitoring is real and that somebody read the actual number instead of the expected one.`
    );
  }

  if (ca.length === 0 && fails.length > 0) {
    body.push(
      `Here is the gap that matters, and it is the reason this lesson exists: there are ${fails.length} recorded ${plural(fails.length, "failure", "failures")} and no corrective actions logged against them at all. Read that the way an inspector reads it — this venue detected a problem, wrote it down, and recorded nothing about what it did next. Detected and ignored is a worse position than never having looked, because you have documented your own knowledge of the problem.`
    );
  } else if (ca.length === 0) {
    body.push(
      "There are no corrective actions in your log. With no failures recorded either, that is consistent — but the moment a check does fail, the corrective action is the entry that protects you, and it is the one most often left blank."
    );
  } else {
    body.push(
      `${ca.length} corrective ${plural(ca.length, "action has", "actions have")} been logged. That is the half of the system most venues never fill in, and it is the half that demonstrates control rather than just attention.`
    );
  }

  if (withNotes.length === 0) {
    body.push(
      "No entry in your log carries a note. Notes are where the story goes — why the reading was high, what was moved, who was told. A bare number proves somebody looked; a note proves somebody thought."
    );
  }

  return {
    id: "your-log",
    title: "What your own log says",
    body,
    bullets,
    keyPoint:
      "A failure with no corrective action beside it documents the problem and not the fix. That is the worst shape a record can be in.",
  };
}

// --------------------------------------------------------------------------- //
// Knowledge lessons
// --------------------------------------------------------------------------- //

const knowledgeLessons: Lesson[] = [
  {
    id: "what-a-system-is",
    title: "What a food safety management system actually is",
    body: [
      "Almost every food business in the developed world is required to have a written food safety management system based on HACCP principles, and to be able to hand it to an inspector. In the EU that requirement sits in Regulation (EC) 852/2004, which asks food business operators to put in place permanent procedures based on the HACCP principles. The UK carries an equivalent duty in its own food hygiene regulations, with Safer Food Better Business as the small-business route. The US uses the FDA Food Code and preventive-control rules that are HACCP-like without always carrying the name, with full HACCP mandatory in specific sectors such as seafood, juice and meat. Check what applies where you are — the shape is the same nearly everywhere, the wording is not.",
      "Stripped of the acronym, the system answers four questions. What could go wrong with the food here? Where is the point at which we can actually stop it? How do we know that point is under control? And what do we do on the day it is not? Everything else — the folder, the forms, the app — exists to answer those four in a way somebody else can check.",
      "The important word is 'system'. Not a good chef, not a clean kitchen, not a team that cares. Those things matter enormously and none of them survive a staff change. A system is what keeps the answers the same when the people change.",
    ],
    keyPoint:
      "Your food safety management system is the written answer to: what could go wrong, where do we stop it, how do we know, and what do we do when it goes wrong anyway.",
  },
  {
    id: "seven-principles",
    title: "The seven principles, in plain language",
    body: [
      "The seven principles come from Codex Alimentarius and are the reason a HACCP plan in Cork looks recognisably like one in Chicago. They are usually written in language nobody speaks. Here they are as questions.",
      "You do not need to recite these in order to do your job. You do need to recognise which one you are standing in when something happens — because that tells you what is expected of you next.",
    ],
    bullets: [
      "1. Hazard analysis — what could actually make someone ill or hurt them here?",
      "2. Identify the critical control points — which steps are the last real chance to stop it?",
      "3. Set critical limits — what is the number or condition that separates safe from not safe?",
      "4. Monitor — who checks it, what do they check, when, and how?",
      "5. Corrective action — what happens when the check fails? To the food, and to the cause?",
      "6. Verification — how do we confirm the whole thing is working, not just being filled in?",
      "7. Records and review — what do we keep, and when do we redo the analysis?",
    ],
    keyPoint:
      "Principles one to three are written once and reviewed. Four and five are what you personally do on a shift.",
  },
  {
    id: "hazards",
    title: "The four kinds of hazard",
    body: [
      "Hazard analysis is principle one, and it goes wrong when people think 'hazard' means 'germs'. There are four families, and a kitchen produces all four.",
      "Biological is the one everyone names — bacteria, viruses, parasites. It is the biggest cause of outbreaks and the reason temperature control dominates every plan.",
      "Chemical means cleaning product, sanitiser, machine oil, pest bait, or a descaler left in a sink. This is the hazard most often introduced by the people trying to prevent the others, which is why chemical safety and food safety are the same conversation.",
      "Physical means glass, metal, plaster from a blue plaster, a bit of packaging, a fragment of a scourer, a fingernail. Rarely fatal, extremely visible, and the fastest route to a complaint that ends up online.",
      "Allergenic is treated as its own family in modern practice rather than lumped in with chemical, because the control is completely different: everything else you control by reducing the amount, and an allergen you control by telling the truth about whether it is there at all. A gram is enough.",
    ],
    keyPoint:
      "Four families: biological, chemical, physical, allergenic. An allergen is the only one where the control is information rather than reduction.",
  },
  {
    id: "ccp-vs-prerequisite",
    title: "Critical control point, or just a good idea?",
    body: [
      "This is where most plans get bloated and then abandoned. A venue decides everything is critical, ends up with forty daily records, and within a month is signing them all at once at the end of the week. A plan nobody can actually complete is worse than a short one, because now the records are fiction.",
      "A critical control point is a step where control is essential and where losing control means the hazard is not caught later. Cooking is a CCP: get the core temperature wrong and nothing downstream fixes it. Chilled storage is a CCP for the same reason. Hot holding, cooling, and in many plans goods-in, all qualify.",
      "Most of what a kitchen does is a prerequisite programme, not a CCP: cleaning, pest control, personal hygiene, maintenance, staff training, supplier approval, waste. These are the conditions that make the CCPs achievable. They absolutely must happen — they are simply not the last line of defence for a specific hazard, and treating them as CCPs is how you end up with forty forms.",
      "The practical test: if this step fails and no later step catches it, and the result is unsafe food reaching a customer, it is a CCP.",
    ],
    keyPoint:
      "A CCP is the last real chance to stop a specific hazard. Cleaning and training are prerequisites — essential, but not the last line.",
  },
  {
    id: "limits",
    title: "Critical limit, target, and the space between",
    body: [
      "A critical limit is the line between safe and unsafe. A target is where you actually aim. They are not the same number, and confusing them is a common and expensive mistake.",
      "Take chilled storage. The figure quoted as the legal maximum varies by country, and a well-run plan sets its own working target several degrees below it. Not because the law was wrong, but because a unit held exactly at its limit crosses it the first time somebody props the door with a crate during a delivery. The gap between target and limit is your reaction time.",
      "This has a direct consequence for how you read your own numbers. A reading that is inside the limit but drifting away from target is information — it means something is changing, usually a door seal, a blocked condenser, or a unit being overloaded. Recording it and saying nothing wastes the early warning. That is what the notes field is for.",
      "It also means 'it passed' is not the same as 'it is fine'. Passing is the legal minimum. Drifting is the thing worth mentioning.",
    ],
    keyPoint:
      "The limit is where the food becomes unsafe. The target is where you aim so a bad afternoon does not reach the limit.",
  },
  {
    id: "monitoring",
    title: "Monitoring: who, what, when, how",
    body: [
      "Principle four is deliberately boring, and it is the one that produces every piece of evidence you will ever be judged on. It has four parts, and a plan missing any one of them does not work.",
      "Who — a named role, not 'someone'. If it belongs to everybody it belongs to nobody, especially at 23:30 on a Saturday.",
      "What — the specific unit and the specific reading. 'Fridges checked' is not monitoring, because it cannot be wrong. 'Main walk-in, 3°C' can be wrong, which is exactly what makes it evidence.",
      "When — a time or a frequency, tied to when the risk is real. Opening, mid-service, close. A single daily check at the calmest moment of the day monitors the calmest moment of the day.",
      "How — with what, calibrated how. A probe nobody has ever checked against iced water is producing numbers, not measurements.",
      "And one rule that overrides all four: record it as you do it. Monitoring reconstructed from memory at the end of a shift is not monitoring, and if the times all look suspiciously identical, an inspector can tell.",
    ],
    keyPoint:
      "Who, what, when, how — recorded at the time. A record written later is a guess with a signature on it.",
  },
  {
    id: "corrective-action",
    title: "Corrective action: the half everyone skips",
    body: [
      "A failed check is not the problem. A failed check with nothing written beside it is the problem. This is principle five, it is the most commonly blank part of any plan, and it is the part that decides whether a failure protects you or convicts you.",
      "A corrective action has three parts, and only the first is obvious.",
      "First, the food. Is it still safe, and what is the decision — use it, cool it, cook it now, or bin it? Say which, and say who decided. 'Discarded' is a perfectly good outcome and reads far better than silence.",
      "Second, the cause. The fridge was at 9°C — why? Door left open, overloaded after a delivery, seal gone, compressor failing? Fixing the reading without fixing the cause guarantees the same entry next week.",
      "Third, the plan. Does anything need to change so this does not recur — a different check time, a repair, a supplier conversation, a word with a shift? Most of the time the answer is no, and writing 'no change needed, door found ajar, closed and re-checked at 14:40, 3°C' is a complete and excellent record.",
      "The instinct to leave it blank is understandable — it feels like writing down evidence against yourself. It is the opposite. A log full of failures with good corrective actions describes a venue in control. A log of unbroken passes describes a venue nobody can verify.",
    ],
    keyPoint:
      "Corrective action covers the food, the cause, and whether the plan changes. A failure with no action recorded is the single worst entry in any log.",
  },
  {
    id: "verification-review",
    title: "Verification and review: is the system actually working?",
    body: [
      "Monitoring asks whether this fridge is cold. Verification asks whether the monitoring itself is any good. They are principles six and seven, they are usually a manager's job rather than a shift job, and they are what turn a folder of forms into a system.",
      "Verification looks like: checking the probe against iced water and boiling water, reading back last month's records for holes and for the tell-tale identical handwriting, spot-checking a reading somebody else recorded, and asking whether the corrective actions actually happened.",
      "Review is principle seven and has clear triggers. Redo the hazard analysis when the menu changes, when a new process appears such as sous-vide or cook-chill, when equipment is installed or retired, when the supplier or the customer changes — a care home or a crèche is not the same risk as a bar — after an outbreak or a complaint, and otherwise at least once a year.",
      "The failure mode is a plan written once, by a consultant, for a menu that no longer exists. It is compliant on the shelf and useless in the kitchen, and an inspector who spots that the plan describes a different business has learned something worse than a missing record.",
    ],
    keyPoint:
      "Review is triggered by change: new menu, new process, new equipment, new customer type, or a complaint. Not by the anniversary alone.",
  },
  {
    id: "records-inspection",
    title: "What an inspector actually reads",
    body: [
      "Inspectors do not read every record. There is not time. They sample, and they look for a small number of specific things — which is useful, because it tells you where to put your effort.",
      "Consistency first. Continuous records with a few honest failures beat immaculate records with a three-week hole. The hole is visible in seconds and does not require reading a single number.",
      "Then failures and what followed. A failure with a good corrective action is a strong signal. A failure with nothing after it is the finding.",
      "Then plausibility. Identical readings every day, all entries in one handwriting, checks logged at times when the venue was closed, or a probe reading to a precision the probe does not have — these read as fabrication, and fabricated records are a far more serious matter than missing ones. In most regimes falsifying a food safety record is an offence in its own right, separate from whatever the record was hiding.",
      "Then the plan against reality. Does the written plan describe this kitchen, this menu, this equipment?",
      "One more thing, and it is the reason to keep this in mind rather than treat records as paperwork: if there is ever a complaint, an illness, or an insurance claim, these records are your defence. A venue with a complete honest log and a documented corrective action is in a genuinely strong position. A venue with a gap where the incident happened has nothing to say.",
    ],
    keyPoint:
      "Consistency, failures with actions, plausibility, and does the plan match the kitchen. Falsified records are treated far more seriously than missing ones.",
  },
];

// --------------------------------------------------------------------------- //
// Lessons
// --------------------------------------------------------------------------- //

export function haccpSystemLessons(
  units: CourseHaccpUnit[],
  checks: CourseHaccpCheck[],
  logs: CourseHaccpLog[]
): Lesson[] {
  const knowledge: Lesson[] = [...knowledgeLessons];
  return [...knowledge, limitsLesson(units), monitoringLesson(checks), logLesson(logs)];
}

// --------------------------------------------------------------------------- //
// Knowledge question bank
// --------------------------------------------------------------------------- //

export function haccpSystemBank(): QuizQuestion[] {
  return [
    {
      id: "hs-what-system",
      kind: "single",
      prompt: "What is a food safety management system, in practical terms?",
      options: [
        "A written set of procedures covering what could go wrong, where it is controlled, how that is monitored, and what happens when it fails",
        "A certificate held by the head chef",
        "The cleaning rota",
        "An annual inspection carried out by the local authority",
      ],
      correct: [0],
      why: "It is a permanent written procedure, not a certificate or an inspection. EU Regulation 852/2004 asks food business operators to put procedures based on HACCP principles in place; the UK and US carry equivalent duties in their own words.",
    },
    {
      id: "hs-why-system",
      kind: "single",
      prompt:
        "Why does a documented system matter in a kitchen that already has experienced staff who care?",
      options: [
        "Because the system is what keeps the answers the same when the people change",
        "It does not — experienced staff make it unnecessary",
        "Only because insurers demand it",
        "Because inspectors are not allowed to talk to staff",
      ],
      correct: [0],
      why: "Skill and care are real and neither survives a staff change, a holiday or a bad night. The system is the part that persists.",
    },
    {
      id: "hs-principles-count",
      kind: "single",
      prompt: "How many HACCP principles are there, and where do they come from?",
      options: [
        "Seven, from Codex Alimentarius",
        "Four, from the EU",
        "Twelve, from the FSAI",
        "Five, set individually by each venue",
      ],
      correct: [0],
      why: "Seven Codex principles are why a plan looks recognisably similar in Ireland, the UK and the US even though the enabling law differs.",
    },
    {
      id: "hs-hazard-families",
      kind: "multi",
      prompt: "Which of these are recognised families of food hazard?",
      options: ["Biological", "Chemical", "Physical", "Allergenic", "Financial"],
      correct: [0, 1, 2, 3],
      why: "Biological, chemical, physical and allergenic. Allergens are treated separately in modern practice because the control is information rather than reduction.",
    },
    {
      id: "hs-allergen-different",
      kind: "single",
      prompt: "Why is an allergen controlled differently from every other hazard?",
      options: [
        "Every other hazard is controlled by reducing it; an allergen is controlled by telling the truth about whether it is present",
        "Allergens are destroyed by thorough cooking",
        "Allergens only matter for pre-packed food",
        "It is not different — it is a chemical hazard like any other",
      ],
      correct: [0],
      why: "Cooking, chilling and cleaning reduce other hazards to a safe level. There is no safe level of an allergen for the person who reacts to it, so the control is accurate information.",
    },
    {
      id: "hs-ccp-definition",
      kind: "single",
      prompt: "What makes a step a critical control point?",
      options: [
        "Control there is essential, and if it fails no later step will catch the hazard",
        "It is the step that takes the longest",
        "It is any step a manager signs off",
        "It is any step involving raw meat",
      ],
      correct: [0],
      why: "The test is whether a later step catches the failure. Cooking and chilled storage pass that test; most other steps are prerequisites.",
    },
    {
      id: "hs-prerequisites",
      kind: "multi",
      prompt: "Which of these are normally prerequisite programmes rather than CCPs?",
      options: [
        "Cleaning and sanitation",
        "Pest control",
        "Staff training",
        "Cooking to a core temperature",
        "Supplier approval",
      ],
      correct: [0, 1, 2, 4],
      why: "Cleaning, pest control, training and supplier approval are the conditions that make CCPs achievable. Cooking is a genuine CCP — nothing downstream fixes an undercooked core.",
    },
    {
      id: "hs-too-many-ccps",
      kind: "single",
      prompt: "What goes wrong when a venue designates almost every step a CCP?",
      options: [
        "The plan becomes impossible to complete, so records get filled in retrospectively and become fiction",
        "Nothing — more control points is always safer",
        "The inspection fee increases",
        "The plan has to be approved by the FSAI",
      ],
      correct: [0],
      why: "A plan nobody can actually complete degrades into batch-signed records, which is worse than a short honest plan.",
    },
    {
      id: "hs-limit-vs-target",
      kind: "single",
      prompt: "What is the difference between a critical limit and a target?",
      options: [
        "The limit is where food becomes unsafe; the target is where you aim so normal variation never reaches the limit",
        "They are two words for the same number",
        "The target is set by law and the limit by the venue",
        "The limit applies to freezers and the target to fridges",
      ],
      correct: [0],
      why: "The gap between target and limit is your reaction time. A unit held exactly at its limit crosses it the first time a door is propped open.",
    },
    {
      id: "hs-drifting",
      kind: "single",
      prompt:
        "A fridge reading is inside its limit but has drifted noticeably away from target over a week. What should happen?",
      options: [
        "Record it, note the drift, and get the cause looked at — it is an early warning",
        "Nothing, it passed",
        "Record it as a fail",
        "Stop using the fridge immediately",
      ],
      correct: [0],
      why: "Drift usually means a seal, a condenser or overloading. Recording the number and saying nothing throws away the warning; that is what the notes field is for.",
    },
    {
      id: "hs-passed-not-fine",
      kind: "single",
      prompt: "Is 'it passed' the same as 'it is fine'?",
      options: [
        "No — passing is the minimum; drift within the limit is still worth reporting",
        "Yes, a pass closes the matter",
        "Only for freezers",
        "Only if a manager countersigns",
      ],
      correct: [0],
      why: "A pass means not unsafe at that moment. It says nothing about the direction things are heading.",
    },
    {
      id: "hs-monitoring-parts",
      kind: "multi",
      prompt: "A monitoring procedure has to specify which of these?",
      options: [
        "Who monitors it",
        "Exactly what is measured",
        "When or how often",
        "How, and with what equipment",
        "The inspector's name",
      ],
      correct: [0, 1, 2, 3],
      why: "Who, what, when and how. Missing any one of the four and the procedure does not work in practice.",
    },
    {
      id: "hs-who-named",
      kind: "single",
      prompt: "Why must monitoring name a role rather than say 'someone will check'?",
      options: [
        "Because a task belonging to everybody belongs to nobody, especially at the end of a busy shift",
        "So blame can be assigned after an incident",
        "Because inspectors require named individuals in the plan",
        "It does not matter as long as the check happens",
      ],
      correct: [0],
      why: "Unowned tasks are the ones that quietly stop. Naming the role is what makes the check survive a busy Saturday.",
    },
    {
      id: "hs-vague-record",
      kind: "single",
      prompt: "Why is 'fridges checked — OK' a weak monitoring record?",
      options: [
        "It cannot be wrong, so it is not evidence — a named unit and an actual reading can be wrong, which is what makes it evidence",
        "It is too short for an inspector to read",
        "It needs a countersignature",
        "It is fine as long as it is dated",
      ],
      correct: [0],
      why: "A record that could never be false proves nothing. 'Main walk-in, 3°C' is checkable, and checkable is the whole point.",
    },
    {
      id: "hs-record-when",
      kind: "single",
      prompt: "When should a monitoring record be written?",
      options: [
        "At the time the check is done",
        "At the end of the shift, from memory",
        "Weekly, in one sitting",
        "Whenever an inspection is announced",
      ],
      correct: [0],
      why: "Reconstructed records are guesses with signatures on them, and batch-written entries are visible — identical times and one handwriting give it away.",
    },
    {
      id: "hs-probe-calibration",
      kind: "single",
      prompt: "A probe has never been checked against iced water or boiling water. What does that mean?",
      options: [
        "It is producing numbers rather than measurements, and every record made with it is weakened",
        "Nothing, digital probes do not drift",
        "It only matters for cooking checks",
        "It means the probe must be replaced annually",
      ],
      correct: [0],
      why: "An uncalibrated probe undermines every reading taken with it. Calibration is part of verification, principle six.",
    },
    {
      id: "hs-corrective-parts",
      kind: "multi",
      prompt: "A corrective action record should cover which of these?",
      options: [
        "What was decided about the food",
        "What caused it",
        "Whether anything in the plan needs to change",
        "Who made the decision",
        "An apology to the customer",
      ],
      correct: [0, 1, 2, 3],
      why: "The food, the cause, whether the plan changes, and who decided. Fixing the reading without the cause guarantees a repeat entry.",
    },
    {
      id: "hs-blank-corrective",
      kind: "single",
      prompt:
        "A check failed and the corrective action was left blank. How does that read to an inspector?",
      options: [
        "That the venue detected a problem, documented it, and recorded nothing about what it did next",
        "That the failure was probably a recording error",
        "As a minor administrative omission",
        "Better than not recording the failure at all",
      ],
      correct: [0],
      why: "Detected and ignored is a worse position than never having looked, because you have documented your own awareness of the problem.",
    },
    {
      id: "hs-discard-ok",
      kind: "single",
      prompt: "Food had to be thrown out after a failed check. What should the record say?",
      options: [
        "That it was discarded, by whom, and why — a clear discard reads well",
        "As little as possible, to avoid admitting waste",
        "Nothing, waste is a stock matter not a food safety one",
        "That it was used in a cooked dish instead",
      ],
      correct: [0],
      why: "A documented discard is evidence of control. Silence is what looks bad, and quietly cooking out a failure is not a corrective action.",
    },
    {
      id: "hs-all-passes",
      kind: "single",
      prompt: "A log shows months of unbroken passes and not one failure. What is the honest reading?",
      options: [
        "It may be a well-run kitchen, or it may mean people record the expected number — a system that never catches anything cannot be verified",
        "It is proof the system is working perfectly",
        "It means the critical limits are set too tightly",
        "It means monitoring can be reduced",
      ],
      correct: [0],
      why: "Failures in a log are evidence that monitoring is real. Their total absence over a long period is worth questioning, not celebrating.",
    },
    {
      id: "hs-verification",
      kind: "single",
      prompt: "What is verification, as distinct from monitoring?",
      options: [
        "Checking that the monitoring itself is sound — calibration, reading back records, spot-checking others' entries",
        "The same thing under a different name",
        "The inspector's visit",
        "Signing the bottom of each page",
      ],
      correct: [0],
      why: "Monitoring asks whether the fridge is cold. Verification asks whether the monitoring can be trusted. It is usually a manager's job.",
    },
    {
      id: "hs-review-triggers",
      kind: "multi",
      prompt: "Which of these should trigger a review of the hazard analysis?",
      options: [
        "The menu changes",
        "A new process such as sous-vide is introduced",
        "Equipment is installed or retired",
        "The venue starts serving a higher-risk customer group",
        "A complaint or suspected illness",
      ],
      correct: [0, 1, 2, 3, 4],
      why: "All of them, plus a periodic review at least annually. Review is triggered by change, not only by the calendar.",
    },
    {
      id: "hs-stale-plan",
      kind: "single",
      prompt:
        "What is wrong with a plan written years ago by a consultant for a menu the venue no longer serves?",
      options: [
        "It is compliant on the shelf and useless in the kitchen — and an inspector who spots the mismatch has found something worse than a missing record",
        "Nothing, as long as it is signed and dated",
        "Only that it needs re-signing each year",
        "It is fine if the consultant is still trading",
      ],
      correct: [0],
      why: "A plan describing a different business tells an inspector the system is not in use at all.",
    },
    {
      id: "hs-inspector-reads",
      kind: "multi",
      prompt: "What does an inspector typically look for when sampling records?",
      options: [
        "Consistency, and gaps in the run",
        "Failures and what was done about them",
        "Whether the entries are plausible",
        "Whether the written plan matches the actual kitchen",
        "Neat handwriting",
      ],
      correct: [0, 1, 2, 3],
      why: "They sample rather than read everything. Gaps are visible in seconds, and a failure with a good corrective action is a strong signal.",
    },
    {
      id: "hs-gap-vs-failures",
      kind: "single",
      prompt:
        "Which looks better on inspection: a continuous log with several honest failures, or an immaculate log with a three-week hole?",
      options: [
        "The continuous log with failures",
        "The immaculate log — failures are findings",
        "They are treated the same",
        "Depends on the season",
      ],
      correct: [0],
      why: "The hole is the first thing spotted and cannot be explained away. Honest failures with actions show a system in use.",
    },
    {
      id: "hs-falsify",
      kind: "single",
      prompt: "How seriously is falsifying a food safety record treated?",
      options: [
        "In most regimes it is an offence in its own right, separate from whatever it concealed, and treated more seriously than a missing record",
        "It is a disciplinary matter only",
        "The same as forgetting to fill it in",
        "It carries no consequence if the food was actually safe",
      ],
      correct: [0],
      why: "A missing record is a gap. A false record destroys the credibility of every other record you hold. Check the exact provision locally, but the principle holds nearly everywhere.",
    },
    {
      id: "hs-records-defence",
      kind: "single",
      prompt: "If there is a complaint or a suspected illness, what role do the records play?",
      options: [
        "They are the venue's defence — a complete honest log with documented corrective actions is a genuinely strong position",
        "They are only relevant to inspections, not complaints",
        "They are best withheld",
        "They matter only if a customer sues",
      ],
      correct: [0],
      why: "A gap where the incident happened leaves nothing to say. This is the practical reason record-keeping is not just paperwork.",
    },
    {
      id: "hs-prerequisite-fail",
      kind: "single",
      prompt:
        "Cleaning is a prerequisite rather than a CCP. Does that mean a missed deep clean is a minor matter?",
      options: [
        "No — prerequisites are the conditions that make the CCPs achievable, and they must happen",
        "Yes, only CCPs are enforceable",
        "Yes, prerequisites are advisory",
        "It depends whether an inspector asks about it",
      ],
      correct: [0],
      why: "'Not a CCP' means it is not the last line of defence for one specific hazard. It does not mean optional.",
    },
    {
      id: "hs-who-writes",
      kind: "single",
      prompt: "Whose responsibility is the food safety management system?",
      options: [
        "The food business operator — the business itself — regardless of who wrote the document",
        "Whichever consultant produced the plan",
        "The head chef personally",
        "The local authority",
      ],
      correct: [0],
      why: "You can buy help writing it. You cannot outsource the duty, and 'the consultant wrote it' is not a defence.",
    },
    {
      id: "hs-not-accredited",
      kind: "single",
      prompt: "What is this course, in terms of qualifications?",
      options: [
        "In-house awareness training delivered by the employer — not an accredited HACCP qualification",
        "An accredited HACCP Level 1 qualification",
        "A food safety certificate valid for three years",
        "Equivalent to a QQI award",
      ],
      correct: [0],
      why: "It produces a dated in-house record signed by the trainee. Accredited HACCP training — QQI Level 1/2/3 in Ireland, or the local equivalent — must come from an approved provider.",
    },
    {
      id: "hs-jurisdiction",
      kind: "single",
      prompt: "How should the legal references in this course be treated?",
      options: [
        "As the shape of the duty in the EU, UK and US, to be checked against the rule where the venue actually trades",
        "As exact requirements everywhere in the world",
        "As Irish law only, irrelevant elsewhere",
        "As optional guidance with no legal basis",
      ],
      correct: [0],
      why: "The seven principles are near-universal; the enabling legislation, the wording and some figures are not. Your own documented procedures take precedence.",
    },
    {
      id: "hs-your-limits-source",
      kind: "single",
      prompt: "Where do the critical limits you work to actually come from?",
      options: [
        "Your venue's own documented system, recorded against each named unit",
        "Whatever figure the person training you remembers",
        "A number agreed verbally with the supplier",
        "The manufacturer's sticker on the appliance",
      ],
      correct: [0],
      why: "A limit not written against a named unit is an intention. Your own documented procedures are what you are judged against.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Venue questions — built from the venue's own register, schedule and log
// --------------------------------------------------------------------------- //

export function venueQuestions(
  units: CourseHaccpUnit[],
  checks: CourseHaccpCheck[],
  logs: CourseHaccpLog[]
): QuizQuestion[] {
  const out: QuizQuestion[] = [];

  // ---- equipment register -------------------------------------------------- //
  if (units.length === 0) {
    out.push({
      id: "hs-nounits",
      kind: "single",
      prompt:
        "This venue has no monitored units on its equipment register. What does that mean for its food safety management system?",
      options: [
        "There is nothing for a monitoring record to point at, so the critical limits are not documented against anything",
        "Nothing — limits apply whether or not units are listed",
        "It means monitoring is not required",
        "It only affects the annual review",
      ],
      correct: [0],
      why: "Limits belong to named units. Until the fridges, freezers and hot-holding units are on the register, an inspector has nothing to read but a general assurance.",
    });
  } else {
    const byType = new Map<string, CourseHaccpUnit[]>();
    for (const u of units) {
      const l = byType.get(u.type) ?? [];
      l.push(u);
      byType.set(u.type, l);
    }

    out.push({
      id: `hs-units-${units.length}`,
      kind: "single",
      prompt: `How many monitored units are on this venue's equipment register?`,
      note: "From your own register.",
      options: [
        `${units.length}`,
        `${units.length + 3}`,
        `${Math.max(units.length - 2, 0)}`,
        "The register does not record a number",
      ],
      correct: [0],
      why: `The register lists ${units.length} monitored ${plural(units.length, "unit", "units")}. Each one carries its own documented target range.`,
    });

    const biggest = [...byType.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (biggest) {
      const [type, list] = biggest;
      const label = list[0].typeLabel;
      out.push({
        id: `hs-toptype-${type}-${list.length}`,
        kind: "single",
        prompt: `Which kind of unit does this venue monitor most of?`,
        note: "From your own register.",
        options: [
          `${label} — ${list.length} of them`,
          `${label} — 1 of them`,
          "It monitors exactly one of each kind",
          "The register does not distinguish between kinds",
        ],
        correct: [0],
        why: `${list.length} ${plural(list.length, "unit", "units")} of that kind are on the register, each with the same target range: ${list[0].target}.`,
      });
    }

    const named = units.filter((u) => u.name).slice(0, 1)[0];
    if (named && named.target && named.target !== "no target range recorded") {
      out.push({
        id: `hs-unit-target-${named.id.slice(-6)}`,
        kind: "single",
        prompt: `"${named.name}" is on your register as a ${named.typeLabel.toLowerCase()}. What is the documented target range for it?`,
        note: "From your own register.",
        options: [
          named.target,
          "Whatever the appliance dial is set to",
          "There is no target — it is checked by feel",
          "The same range as every other unit in the building",
        ],
        correct: [0],
        why: `Your own system records ${named.target} for that unit. The limit belongs to the unit, not to whoever is checking it.`,
      });
    }
  }

  // ---- monitoring schedule ------------------------------------------------- //
  const active = checks.filter((c) => c.active);
  if (active.length === 0) {
    out.push({
      id: "hs-nosched",
      kind: "single",
      prompt:
        "This venue has no scheduled checks configured. What is the real risk of relying on people remembering instead?",
      options: [
        "It works until the person who normally remembers is away, and then it stops without anyone noticing",
        "None, as long as the checks get done most days",
        "Only that reminders will not appear in the app",
        "It makes the records invalid",
      ],
      correct: [0],
      why: "Principle four asks who, what, when and how. A habit answers none of those in a way that survives a holiday or a leaver.",
    });
  } else {
    out.push({
      id: `hs-sched-${active.length}`,
      kind: "single",
      prompt: "How many scheduled checks does this venue have configured?",
      note: "From your own schedule.",
      options: [
        `${active.length}`,
        `${active.length + 2}`,
        "None",
        "One for every unit on the register",
      ],
      correct: [0],
      why: `${active.length} scheduled ${plural(active.length, "check", "checks")}. The schedule is the 'when' of principle four made concrete.`,
    });

    const withTimes = active.filter((c) => c.times.length > 0);
    const most = [...withTimes].sort((a, b) => b.times.length - a.times.length)[0];
    if (most && most.times.length > 1) {
      out.push({
        id: `hs-sched-times-${most.checkType}-${most.times.length}`,
        kind: "single",
        prompt: `How many times a day is "${most.label}" scheduled at this venue?`,
        note: "From your own schedule.",
        options: [
          `${most.times.length} — at ${most.times.join(", ")}`,
          "Once, at opening",
          "Only when a manager asks",
          "It is not scheduled",
        ],
        correct: [0],
        why: `Your schedule sets ${most.times.length} ${plural(most.times.length, "time", "times")}: ${most.times.join(", ")}. Spreading checks across the day monitors the day, not just the quietest moment of it.`,
      });
    }

    const noTimes = active.filter((c) => c.times.length === 0);
    if (noTimes.length > 0) {
      out.push({
        id: `hs-sched-notimes-${noTimes.length}`,
        kind: "single",
        prompt: `${noTimes.length} of this venue's scheduled ${plural(noTimes.length, "check has", "checks have")} no times set. What is the consequence?`,
        options: [
          "No reminder will fire for them, so they are a line in a document rather than a prompt on somebody's phone",
          "They will be prompted hourly by default",
          "They become optional",
          "Nothing — times are cosmetic",
        ],
        correct: [0],
        why: "A scheduled check with no time never prompts anybody. Either set a time or accept it is not really scheduled.",
      });
    }
  }

  // ---- the log ------------------------------------------------------------- //
  if (logs.length === 0) {
    out.push({
      id: "hs-nolog",
      kind: "single",
      prompt:
        "There are no logged checks for this venue. How does a venue that monitors carefully but records nothing compare, on inspection, to one that monitors nothing?",
      options: [
        "They are indistinguishable — there is no way to prove the difference after the fact",
        "The careful venue can rely on staff testimony",
        "The careful venue is fine as long as no one is ill",
        "Records are only needed once a venue exceeds a certain size",
      ],
      correct: [0],
      why: "The record is the only evidence that leaves the kitchen. Without it there is nothing to distinguish diligence from neglect.",
    });
  } else {
    const win = logWindow(logs);
    const fails = failures(logs);
    const ca = correctiveActions(logs);

    out.push({
      id: `hs-log-${logs.length}-days-${win.days}`,
      kind: "single",
      prompt: "How many checks has this venue logged, and across how many days?",
      note: "From your own log.",
      options: [
        `${logs.length} checks across ${win.days} ${plural(win.days, "day", "days")}`,
        `${logs.length + 20} checks across ${win.days} ${plural(win.days, "day", "days")}`,
        "None yet",
        "The log does not record dates",
      ],
      correct: [0],
      why: `Your log holds ${logs.length} ${plural(logs.length, "entry", "entries")} over ${win.days} ${plural(win.days, "day", "days")}. Consistency across the run is the first thing an inspector reads.`,
    });

    if (win.newest && daysAgo(win.newest) >= 7) {
      const d = daysAgo(win.newest);
      out.push({
        id: `hs-stale-${d}`,
        kind: "single",
        prompt: `The most recent check in this venue's log was ${agoPhrase(win.newest)}. What does a gap that size mean?`,
        options: [
          "It is visible without reading a single temperature, and for that window the log says nothing happened at all",
          "Nothing, as long as the checks resume",
          "It is acceptable if the venue was quiet",
          "It only matters if a customer complains",
        ],
        correct: [0],
        why: `${d} days with no entry is the first thing spotted on inspection. Whatever actually happened, the record cannot show it.`,
      });
    }

    if (fails.length === 0) {
      out.push({
        id: `hs-allpass-${logs.length}`,
        kind: "single",
        prompt: `Every one of this venue's ${logs.length} logged checks is a pass. What is the honest reading of that?`,
        options: [
          "It may be a well-run kitchen, or it may mean expected numbers are being recorded — a system that never catches anything cannot be verified",
          "It proves the system is working perfectly",
          "It means the limits are too tight",
          "It means monitoring can be reduced",
        ],
        correct: [0],
        why: "Failures are evidence that monitoring is real. An unbroken run of passes is worth questioning rather than celebrating.",
      });
    } else {
      out.push({
        id: `hs-fails-${fails.length}-of-${logs.length}`,
        kind: "single",
        prompt: `${fails.length} of this venue's ${logs.length} logged checks did not pass. How should that be read?`,
        note: "From your own log.",
        options: [
          "As the system working — a recorded failure proves somebody read the actual number rather than the expected one",
          "As a black mark against the kitchen",
          "As a reason to loosen the limits",
          "As a recording error to be corrected",
        ],
        correct: [0],
        why: "A failure in the log is evidence of real monitoring. What matters is whether a corrective action sits beside it.",
      });
    }

    if (ca.length === 0 && fails.length > 0) {
      out.push({
        id: `hs-nocorrective-${fails.length}`,
        kind: "single",
        prompt: `This venue has ${fails.length} recorded ${plural(fails.length, "failure", "failures")} and no corrective actions logged at all. What does the record currently show?`,
        note: "From your own log.",
        options: [
          "That the venue detected a problem, documented it, and recorded nothing about what it did next",
          "That the failures were resolved satisfactorily",
          "That corrective actions were unnecessary",
          "That the failures were recording errors",
        ],
        correct: [0],
        why: "This is the single most important gap to close in this venue's log. Detected and ignored is a worse position than never having looked.",
      });
    } else if (ca.length > 0) {
      out.push({
        id: `hs-corrective-${ca.length}`,
        kind: "single",
        prompt: `This venue has logged ${ca.length} corrective ${plural(ca.length, "action", "actions")}. What does a corrective action need to cover to be complete?`,
        note: "From your own log.",
        options: [
          "The decision about the food, the cause, and whether the plan needs to change",
          "Only what was done with the food",
          "Only the cause",
          "Only that a manager was informed",
        ],
        correct: [0],
        why: "All three. Fixing the reading without the cause guarantees the same entry next week.",
      });
    }

    const withNotes = logs.filter((l) => l.hasNotes);
    if (withNotes.length === 0) {
      out.push({
        id: `hs-nonotes-${logs.length}`,
        kind: "single",
        prompt:
          "No entry in this venue's log carries a note. What is lost by recording only the number?",
        options: [
          "The reasoning — a bare number proves somebody looked, a note proves somebody thought",
          "Nothing, notes are optional decoration",
          "Only the ability to export the log",
          "The record becomes invalid",
        ],
        correct: [0],
        why: "Notes are where drift, causes and decisions go. They are also what turns a passed check into an early warning.",
      });
    }

    const readings = logs.filter((l) => l.reading !== null);
    if (readings.length > 0) {
      out.push({
        id: `hs-readings-${readings.length}-of-${logs.length}`,
        kind: "single",
        prompt: `${readings.length} of this venue's ${logs.length} logged checks carry an actual numeric reading. Why does that matter more than a tick?`,
        note: "From your own log.",
        options: [
          "A number can be wrong, and that is exactly what makes it evidence — a tick cannot be wrong, so it proves nothing",
          "Numbers are required by law and ticks are not",
          "Ticks are only allowed for cleaning checks",
          "It does not matter, both are records",
        ],
        correct: [0],
        why: "A record that could never be false is not evidence. This is why 'Main walk-in, 3°C' beats 'fridges checked'.",
      });
    }

    const newestNamed = [...logs]
      .filter((l) => l.subject)
      .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())[0];
    if (newestNamed && newestNamed.checkedAt) {
      out.push({
        id: `hs-newest-${newestNamed.checkType}`,
        kind: "single",
        prompt: `The most recent named entry in this venue's log is a ${newestNamed.label.toLowerCase()} entry for "${newestNamed.subject}", logged ${agoPhrase(newestNamed.checkedAt)}. Why does the record name the unit?`,
        note: "From your own log.",
        options: [
          "So the reading can be tied to a specific unit with its own documented limit, and checked afterwards",
          "For stock control purposes",
          "So the person who checked it can be identified",
          "It is not necessary — the name is cosmetic",
        ],
        correct: [0],
        why: `Naming the unit is what makes the entry verifiable. Note that Rotahr deliberately does not carry who logged it into training content — the unit matters here, the person does not.`,
      });
    }
  }

  return out;
}

// --------------------------------------------------------------------------- //
// The paper
// --------------------------------------------------------------------------- //

const KNOWLEDGE_FLOOR = 8;
const TARGET = 12;

export function haccpSystemQuiz(
  units: CourseHaccpUnit[],
  checks: CourseHaccpCheck[],
  logs: CourseHaccpLog[],
  seed: number
): QuizQuestion[] {
  const venue = shuffled(venueQuestions(units, checks, logs), seed + 13);
  const knowledge = shuffled(haccpSystemBank(), seed + 37);

  // Always keep a floor of knowledge questions so a venue with rich data does
  // not end up with a paper that is all venue trivia and no understanding.
  const knowledgeTake = Math.max(KNOWLEDGE_FLOOR, TARGET - venue.length);
  const picked = [...knowledge.slice(0, knowledgeTake), ...venue];

  return shuffled(picked, seed);
}
