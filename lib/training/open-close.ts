/**
 * Opening and closing the venue — in-house course content.
 *
 * ── What this is ────────────────────────────────────────────────────────────
 * Employer-delivered awareness training on the two routines that bracket every
 * trading day: the walk round before the doors open, and the walk round after
 * the last guest leaves. An operator is generally expected to instruct and
 * supervise staff in the matters appropriate to their work, and to keep records
 * that show the checks were done. Neither of those requires an awarding body.
 *
 * ── What it is NOT ──────────────────────────────────────────────────────────
 * It is NOT a HACCP Level 1 or 2, not a food safety certificate, not a fire
 * warden or key-holder qualification, and not a security or licensing
 * qualification. Temperatures, times and security steps below are stated as
 * widely used practice with a nudge to follow the venue's own procedure and the
 * local rule. The venue's written procedure, and the manager on duty, beat any
 * training material — including this one.
 *
 * ── Where the venue data comes from ─────────────────────────────────────────
 * The course reads the venue's own opening and closing checklist records: how
 * much of the list was actually ticked, when the last one was logged, and
 * whether one of the two routines is being recorded and the other is not. A
 * half-ticked list saved as a pass is the sharpest lesson in the course, and it
 * is a real one, not an invented example.
 *
 * Checklist templates a venue has edited for itself are read by the LESSONS
 * ONLY and never by the quiz: a manager can add or remove a task while somebody
 * is halfway through the course, and a graded paper has to rebuild identically
 * at submit time. The records themselves are immutable in practice and their
 * ids ride on the signed ticket, which is why they can be graded.
 *
 * ── What this course deliberately does not cover ────────────────────────────
 * Chemicals, dilutions and the two-stage clean belong to the cleaning and
 * chemical safety course. Date labels, cross-contamination and the hygiene
 * rules themselves belong to food hygiene awareness. This one is about the
 * routine at the start and the end of a shift, and about the record it leaves.
 */

import {
  DEFAULT_CLEANING_ITEMS,
  niceDate,
  type CourseCleaningRecord,
  type CourseCleaningTemplate,
  type Lesson,
  type QuizQuestion,
  shuffled,
} from "./kit";

const OPEN = "opening_checks";
const CLOSE = "closing_checks";

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Only the two checklist types this course is about. */
function openClose(records: CourseCleaningRecord[]): CourseCleaningRecord[] {
  return records.filter((r) => r.checkType === OPEN || r.checkType === CLOSE);
}

/** Newest record of a type, or undefined. Deterministic — sorted by date. */
function latestOf(records: CourseCleaningRecord[], checkType: string) {
  return records
    .filter((r) => r.checkType === checkType)
    .slice()
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
}

function latestAny(records: CourseCleaningRecord[]) {
  return records.slice().sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
}

/**
 * Whole days between a record and the start of today.
 *
 * Measured from midnight rather than the exact clock so a paper rebuilt twenty
 * minutes later during grading reads the same number and grades the same way.
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

/** How many tasks the list for a type holds, taking an edited list first. */
function listSize(
  checkType: string,
  templates: CourseCleaningTemplate[]
): { count: number; edited: boolean } {
  const t = templates.find((x) => x.checkType === checkType);
  if (t && t.itemCount > 0) return { count: t.itemCount, edited: true };
  return { count: (DEFAULT_CLEANING_ITEMS[checkType] ?? []).length, edited: false };
}

/** The widest gap between what was on the list and what got ticked. */
function bestPartial(records: CourseCleaningRecord[]): CourseCleaningRecord | undefined {
  const partials = records.filter(
    (r) => r.expectedCount > 0 && r.tickedCount < r.expectedCount
  );
  if (partials.length === 0) return undefined;
  return partials.slice().sort((a, b) => {
    const ga = a.expectedCount - a.tickedCount;
    const gb = b.expectedCount - b.tickedCount;
    if (ga !== gb) return gb - ga;
    return b.checkedAt.localeCompare(a.checkedAt);
  })[0];
}

// --------------------------------------------------------------------------- //
// Lessons
// --------------------------------------------------------------------------- //

export function openCloseLessons(
  records: CourseCleaningRecord[],
  templates: CourseCleaningTemplate[] = []
): Lesson[] {
  const rows = openClose(records);
  const openings = rows.filter((r) => r.checkType === OPEN);
  const closings = rows.filter((r) => r.checkType === CLOSE);
  const lastOpen = latestOf(rows, OPEN);
  const lastClose = latestOf(rows, CLOSE);
  const openList = listSize(OPEN, templates);
  const closeList = listSize(CLOSE, templates);

  // ---- oc-why ------------------------------------------------------------ //
  const why: Lesson = {
    id: "oc-why",
    title: "Why the first and last hour matter most",
    body: [
      "Almost everything that goes badly wrong in a hospitality venue is set up in one of two windows: the hour before the doors open, and the hour after the last guest leaves. A fridge that failed overnight, a fire exit with a delivery stacked against it, a fryer left on, a back door left on the latch. None of those are dramatic at the time. They are all quiet.",
      "The opening routine exists to catch things that changed while nobody was here. The closing routine exists to leave the building in a state where nothing can go wrong while nobody is here again. That is the whole idea, and it is why the two lists look different: one is a set of questions, the other is a set of actions.",
      "The second reason both exist is evidence. Nobody can go back and inspect last Tuesday. The record you leave is the only version of last Tuesday that will ever exist. If an environmental health officer, an insurer or your own manager asks whether the fridges were checked on the morning of the 14th, the answer is whatever the log says — and if the log says nothing, the answer is nobody knows.",
    ],
    bullets: [
      "Opening: is the venue safe and legal to trade from right now?",
      "Closing: will it still be safe when nobody is here to watch it?",
      "The record turns both from a habit into something the venue can show.",
    ],
    keyPoint:
      "Opening checks catch what changed overnight. Closing checks stop anything changing overnight. The log is what makes either of them provable.",
  };

  // ---- oc-open ----------------------------------------------------------- //
  const openBullets = (DEFAULT_CLEANING_ITEMS[OPEN] ?? []).slice();
  const open: Lesson = {
    id: "oc-open",
    title: "The opening walk",
    body: [
      "An opening check is a walk, not a form. You walk the same route every day, in the same order, looking at the things that can have changed since you locked up: cold storage, hand washing, covered and labelled food, the state of the prep surfaces, any sign of pests, and whether the equipment powers up and holds.",
      "Do it in an order that follows the building rather than the order printed on the list. Most people walk cold storage first, because a fridge or freezer that has drifted overnight is the finding with the biggest consequences and the one that needs the most time to sort out. Everything else is quicker to fix.",
      openList.edited
        ? `Your venue has edited its own opening list, and it now holds ${openList.count} ${plural(openList.count, "task", "tasks")}. Use your list, not this one — a venue that has adapted the list has usually done it because something here needed watching.`
        : `Your venue is using the standard opening list of ${openList.count} tasks. It can be edited in the HACCP section if there is something specific to this building worth adding, such as a particular unit that drifts or a door that does not always latch.`,
    ],
    bullets: openBullets,
    keyPoint:
      "Walk the building in a fixed order and start with cold storage. The order stops you skipping the boring half of the list.",
  };

  // ---- oc-partial -------------------------------------------------------- //
  let partialBody: string[];
  let partialBullets: string[] | undefined;
  if (rows.length === 0) {
    partialBody = [
      "This is normally the most useful lesson in the course, because it is the only part no outside training provider can give you: what your own opening and closing records show about how these two routines actually get done here.",
      "Nothing has been logged here yet. That is worth being straight about. It does not mean the checks are not happening, and it does not mean anybody is cutting corners. Plenty of well-run venues open and close carefully and write none of it down.",
      "What it does mean is that there is no way to show it, and no way to see a pattern. If the same task is being skipped every Saturday, an empty log will never tell you. Logging the list takes well under a minute at each end of the day, and the value is not the tick — it is being able to read the week back.",
    ];
  } else {
    const partial = bestPartial(rows);
    const lines: string[] = [];
    if (lastOpen) {
      lines.push(
        `Opening checks: ${openings.length} ${plural(openings.length, "record", "records")}, last logged ${niceDate(lastOpen.checkedAt)} (${agoPhrase(lastOpen.checkedAt)}) — ${lastOpen.tickedCount} of ${lastOpen.expectedCount} tasks ticked, saved as "${lastOpen.status}"`
      );
    } else {
      lines.push("Opening checks: nothing logged here at all");
    }
    if (lastClose) {
      lines.push(
        `Closing checks: ${closings.length} ${plural(closings.length, "record", "records")}, last logged ${niceDate(lastClose.checkedAt)} (${agoPhrase(lastClose.checkedAt)}) — ${lastClose.tickedCount} of ${lastClose.expectedCount} tasks ticked, saved as "${lastClose.status}"`
      );
    } else {
      lines.push("Closing checks: nothing logged here at all");
    }
    partialBullets = lines;
    partialBody = [
      "This is the part of the course that is genuinely about your venue rather than about hospitality in general. Below is what your own opening and closing records currently say.",
      partial
        ? `The line worth looking at twice is the ${partial.label.toLowerCase()} logged ${niceDate(partial.checkedAt)}: ${partial.tickedCount} of ${partial.expectedCount} tasks ticked, and saved as "${partial.status}". Read that back as somebody who was not there. Either most of the list was skipped, or it was done and not ticked. Nobody can tell which, and that is the problem — a record that cannot be read is not evidence of anything.`
        : "Every task on the list has been ticked on these records. That is the right shape, and it is worth saying plainly. The one thing a full set of ticks still cannot show is whether each tick was earned, which comes down to the person filling it in.",
      "The fix is not to tick more. It is to tick what was actually done, and to write one line about what was not and why. A part-done list with a note is information a manager can act on. A full list of ticks that did not happen is a false record, and it quietly devalues every honest entry beside it.",
    ];
  }
  const partialLesson: Lesson = {
    id: "oc-partial",
    title: "What your own records show",
    body: partialBody,
    bullets: partialBullets,
    keyPoint:
      "A half-ticked list saved as a pass tells a reader nothing except that the paperwork cannot be trusted. Tick what happened, note what did not.",
  };

  // ---- oc-fault ---------------------------------------------------------- //
  const fault: Lesson = {
    id: "oc-fault",
    title: "When something fails at open",
    body: [
      "A failed opening check is the routine working. The mistake is treating a fail as a paperwork problem instead of a decision: something is not right, so what happens to the service that depends on it?",
      "The general rule is that you do not open the part of the operation that depends on the thing that failed. A walk-in reading well above the chilled range means the food in it needs a decision before anybody preps from it, not after. A hand wash basin with no hot water means that section cannot run. A blocked fire exit is not a service question at all, it is cleared before anything else happens.",
      "Then it gets recorded twice: the check itself as a fail, and the action you took as a corrective action. A fail with no action beside it is the worst entry in any log, because it proves somebody saw the problem and shows nothing being done about it. Widely used chilled and frozen targets are around 5°C or below and around -18°C, but follow the target your venue has set for that unit and the local rule.",
    ],
    bullets: [
      "Do not open the section that depends on what failed.",
      "Escalate to the manager on duty at the time, not at the end of the shift.",
      "Log the fail and log what you did about it — both, not one.",
      "Food of doubtful safety is a manager decision, never a quiet one.",
    ],
    keyPoint:
      "A fail on its own is half a record. The corrective action beside it is the half that protects everybody, including you.",
  };

  // ---- oc-close ---------------------------------------------------------- //
  const closeBullets = (DEFAULT_CLEANING_ITEMS[CLOSE] ?? []).slice();
  const close: Lesson = {
    id: "oc-close",
    title: "The closing walk",
    body: [
      "Closing is the tired end of the day, which is exactly why it is the one that gets rushed. Every item on a closing list is there because of something that has gone wrong in somebody's venue: food left out, a fryer left on, a bin left inside, a fridge door left resting against its seal.",
      "Two of them matter more than the rest. Food gets stored, covered, labelled and cooled properly before it goes away — hot food closed into a fridge warms everything around it. And equipment gets switched off at the point that actually isolates it, not just at the front panel.",
      closeList.edited
        ? `Your venue has edited its own closing list, and it now holds ${closeList.count} ${plural(closeList.count, "task", "tasks")}.`
        : `Your venue is using the standard closing list of ${closeList.count} tasks.`,
    ],
    bullets: closeBullets,
    keyPoint:
      "The closing round is the one nobody wants to do properly. Work the list rather than your memory, because at 1am your memory is the least reliable thing in the building.",
  };

  // ---- oc-security ------------------------------------------------------- //
  const security: Lesson = {
    id: "oc-security",
    title: "Locking up: keys, gas, doors and cash",
    body: [
      "Locking up is a small set of things that are hard to undo if you get them wrong. Fire exits have to stay usable as exits right up until the building is empty, and secure after — never chained or blocked while anybody is inside. Gas gets isolated where the venue's procedure says to isolate it, and if you have not been shown where that is, ask before you are the last one out.",
      "Windows and back doors are the ones that get missed, because they are opened during service by somebody who is not the person closing. Walk them rather than assume them. The bin area is worth a look on the way past: a bag left beside a full bin is how a pest problem starts, and pests are far more expensive than the two minutes it takes.",
      "Cash and alarms follow whatever your venue has set down, and that varies enough between venues that this course will not tell you a number. What is universal is that the person closing should know who to ring at 1am, and should ring them rather than deal with something alone. Nothing in the building is worth more than the person closing it.",
    ],
    bullets: [
      "Exits usable while anybody is inside, secure after.",
      "Gas and equipment isolated the way your venue's procedure says.",
      "Walk the back doors and windows instead of assuming them.",
      "Know who to call, and call them. Do not handle an intruder or a flood alone.",
    ],
    keyPoint:
      "Follow your venue's own lock-up procedure and know the out-of-hours number before you need it.",
  };

  // ---- oc-timing --------------------------------------------------------- //
  const timing: Lesson = {
    id: "oc-timing",
    title: "Log it at the moment, not from memory",
    body: [
      "A checklist filled in at the moment of the check is a record. The same checklist filled in at three in the afternoon from memory is an opinion about the morning, and it is usually a generous one.",
      "Two habits make a log worthless. Pre-ticking, where the list is completed before the walk in the sensible belief that it will all be fine. And backfilling, where a missed day gets filled in later so the record looks complete. Both feel harmless and both are false records — and if one entry is invented, a reader has no reason to believe any of the others.",
      "If a day was genuinely missed, the honest entry is that it was missed. A gap with a reason costs a venue very little. A fabricated record, found once, costs it the credibility of the entire log and can make a bad situation considerably worse.",
    ],
    bullets: [
      "Tick as you walk, not before and not hours after.",
      "Never complete a list for a check that did not happen.",
      "A missed day recorded as missed is worth more than a perfect invented one.",
    ],
    keyPoint:
      "The value of the whole log rests on nobody ever writing down something that did not happen.",
  };

  // ---- oc-handover ------------------------------------------------------- //
  const handover: Lesson = {
    id: "oc-handover",
    title: "The record as a handover",
    body: [
      "The person who opens is almost never the person who closed. The log is the only conversation those two shifts get to have, so a note on it is worth more than a note in somebody's head.",
      "That is what the notes field is for: the freezer that read a degree high but recovered, the door that needed two goes to latch, the delivery stacked in front of the exit that got moved. None of those are incidents. All of them are things the next shift would want to know, and all of them are how a small fault gets caught before it becomes a closed kitchen.",
      "Reading the log back is the part almost nobody does, and it is where the value actually is. A manager who reads a fortnight of opening checks sees the task that is never ticked and the unit that keeps coming up. That is not paperwork any more, it is the venue telling you what to fix.",
      templates.length > 0
        ? "Your venue has already adapted at least one of these checklists for itself, which is the right instinct: the list should describe this building, not a generic one."
        : "Nobody here has edited these two checklists yet. If the same note keeps appearing on the log, that is usually the sign that it should become a line on the list instead.",
    ],
    bullets: [
      "Write the note for the next shift, not for an inspector.",
      "Read the last fortnight back before you order a repair or a change.",
      "A note that keeps repeating belongs on the checklist itself.",
    ],
    keyPoint:
      "The log is a handover between shifts that never meet. It only works if somebody writes in it and somebody reads it.",
  };

  return [why, open, partialLesson, fault, close, security, timing, handover];
}

// --------------------------------------------------------------------------- //
// Knowledge bank
// --------------------------------------------------------------------------- //

function openCloseBank(): QuizQuestion[] {
  return [
    {
      id: "o-purpose-open",
      kind: "single",
      prompt: "What is the opening check actually for?",
      options: [
        "To show an inspector that paperwork is being done",
        "To find what changed while the venue was closed, before service depends on it",
        "To hand out the day's jobs",
        "To record how clean the venue was left",
      ],
      correct: [1],
      why: "Fridges drift, deliveries get stacked in the wrong place and equipment fails overnight. The opening walk exists to catch those before anybody preps, serves or seats a guest.",
    },
    {
      id: "o-purpose-close",
      kind: "single",
      prompt: "What is the closing check for?",
      options: [
        "To prove who was on the last shift",
        "To leave the building in a state where nothing can go wrong while it is empty",
        "To tidy up so the morning looks better",
        "To record the takings",
      ],
      correct: [1],
      why: "Food stored properly, equipment isolated, bins out, doors secure. Every line on a closing list is there because of something that went wrong in an empty building somewhere.",
    },
    {
      id: "o-order",
      kind: "single",
      prompt: "Which part of the opening walk is usually worth doing first?",
      options: [
        "Floors, because that is what guests see",
        "Cold storage, because a unit that drifted overnight has the biggest consequences and takes the longest to sort",
        "The till and the float",
        "Whatever is at the top of the printed list",
      ],
      correct: [1],
      why: "A walk-in that has been out of range all night is a decision about food, not a tick. It needs the most time and the manager on duty, so it is found first.",
    },
    {
      id: "o-fail-action",
      kind: "single",
      prompt: "An opening check fails. What has to be recorded?",
      options: [
        "The fail on its own",
        "Both the fail and the corrective action taken",
        "Only the corrective action, so the log stays clean",
        "Nothing until it is fixed",
      ],
      correct: [1],
      why: "A fail with nothing beside it proves somebody saw a problem and shows nothing being done. The action is the half of the record that matters.",
    },
    {
      id: "o-fail-service",
      kind: "single",
      prompt: "The hand wash basin in the kitchen has no hot water at open. What is the right call?",
      options: [
        "Open as normal and use the staff toilet instead",
        "Treat it as a stop on that section, tell the manager on duty now, and record the fault and what was done",
        "Note it on the list and carry on",
        "Wait and see whether it comes back during service",
      ],
      correct: [1],
      why: "Hand washing is not an optional part of a kitchen. Escalate it at the moment it is found, because a manager can arrange an alternative or a repair before service, not after.",
    },
    {
      id: "o-exit",
      kind: "single",
      prompt: "You find a delivery stacked in front of a fire exit during the opening walk.",
      options: [
        "Note it and mention it at the end of the shift",
        "Clear it immediately, before anything else on the list",
        "Move it only if it blocks the door completely",
        "Leave it — the other exit is clear",
      ],
      correct: [1],
      why: "A blocked exit is not a service decision or a paperwork item. It gets cleared straight away, and it is worth logging so somebody asks why it was stacked there.",
    },
    {
      id: "o-pretick",
      kind: "single",
      prompt: "Is it acceptable to fill in the opening list before doing the walk, if you know the venue is fine?",
      options: [
        "Yes, as long as the walk happens afterwards",
        "No — a list ticked before the check is a false record, whatever happens next",
        "Yes, if a manager approves it",
        "Yes, on quiet days",
      ],
      correct: [1],
      why: "Pre-ticking is how the one morning that was not fine gets recorded as fine. The record has to follow the check, never lead it.",
    },
    {
      id: "o-backfill",
      kind: "single",
      prompt: "Nobody logged the closing checks on Saturday. It is now Monday. What is the honest thing to do?",
      options: [
        "Fill Saturday in now so the record is complete",
        "Leave the gap, note that it was missed, and tell a manager",
        "Copy Friday's entry across",
        "Delete the week so the gap is not obvious",
      ],
      correct: [1],
      why: "Backfilling turns a small gap into a fabricated record. One invented entry gives a reader a reason to doubt every other line in the log.",
    },
    {
      id: "o-partial-honest",
      kind: "single",
      prompt: "You get through nine of the twelve tasks on the closing list before you have to leave. What goes in the log?",
      options: [
        "All twelve ticks — the rest will be done in the morning",
        "The nine that were done, plus a note saying which three were not and why",
        "Nothing, because the list is incomplete",
        "Nine ticks and no note",
      ],
      correct: [1],
      why: "Nine ticks and a note is information the opening shift can act on. Twelve ticks is a lie, and nine with no note leaves the next person guessing.",
    },
    {
      id: "o-status",
      kind: "single",
      prompt: "What does a checklist record saved as a pass, with only half the tasks ticked, tell somebody reading it back?",
      options: [
        "That the check was completed successfully",
        "Almost nothing — they cannot tell a skipped list from a badly filled-in one",
        "That the list is too long",
        "That the venue failed the check",
      ],
      correct: [1],
      why: "The status and the ticks contradicting each other is what makes the entry useless. Evidence has to be readable by somebody who was not there.",
    },
    {
      id: "o-hotfood",
      kind: "single",
      prompt: "At close there is a tray of hot food to put away. What is the problem with sealing it and putting it straight into the fridge?",
      options: [
        "There is no problem if it is covered",
        "It warms everything around it and sits too long in the range where bacteria multiply fastest",
        "It makes the fridge work quietly",
        "It only matters for meat",
      ],
      correct: [1],
      why: "Hot food has to be cooled quickly and then chilled. Putting it in hot pushes the whole cabinet up and puts every other item in it at risk.",
    },
    {
      id: "o-equipoff",
      kind: "single",
      prompt: "What does switching equipment off properly at close mean?",
      options: [
        "Turning the front control down to zero",
        "Isolating it the way your venue's procedure says, so it cannot run unattended",
        "Unplugging everything in the building, including the fridges",
        "Whatever the last person did",
      ],
      correct: [1],
      why: "A control turned down is not the same as isolated, and some things must stay on. Follow the procedure for this building, and ask if nobody has shown you.",
    },
    {
      id: "o-fridges-on",
      kind: "multi",
      prompt: "Which of these should NOT be switched off at close? Select all that apply.",
      options: [
        "Fridges and freezers",
        "The fryer",
        "Cold room refrigeration",
        "The grill",
      ],
      correct: [0, 2],
      why: "Cold storage runs through the night, and the point of the closing check is that its doors are shut and its temperatures normal. Cooking equipment is the opposite.",
    },
    {
      id: "o-bins",
      kind: "single",
      prompt: "Why is the bin area part of the closing round rather than the morning?",
      options: [
        "It looks better for guests",
        "Waste left inside overnight is one of the most common ways a pest problem starts",
        "The bins are emptied at night",
        "It is quicker at night",
      ],
      correct: [1],
      why: "An empty building with food waste in it is an invitation. Pests are far more expensive and far harder to remove than the two minutes the job takes.",
    },
    {
      id: "o-exit-lock",
      kind: "single",
      prompt: "When can a fire exit be chained or blocked?",
      options: [
        "After the last guest leaves",
        "Once the building is completely empty and secured, following the venue's procedure — never while anybody is inside",
        "During quiet periods",
        "Whenever security is a concern",
      ],
      correct: [1],
      why: "An exit has to work as an exit for as long as there is a person in the building, including the person closing up alone.",
    },
    {
      id: "o-lonecall",
      kind: "single",
      prompt: "You are closing alone and find the back door has been forced. What is the right response?",
      options: [
        "Search the building to check whether anybody is inside",
        "Leave, get somewhere safe, and ring the number your venue gives for out of hours",
        "Secure the door and finish the closing list",
        "Wait outside until the morning shift arrives",
      ],
      correct: [1],
      why: "Nothing in the building is worth more than the person closing it. Knowing the out-of-hours number before you need it is part of being trusted with the keys.",
    },
    {
      id: "o-handover-note",
      kind: "single",
      prompt: "A freezer read a degree high at close but had recovered by the time you left. Worth writing down?",
      options: [
        "No, it recovered",
        "Yes — the next shift needs to know it drifted, because a unit that does it twice is a unit about to fail",
        "Only if it happens again",
        "No, notes are only for failures",
      ],
      correct: [1],
      why: "The log is the handover between two shifts that never meet. A one-off is noise until it is written down twice, and then it is a repair before a breakdown.",
    },
    {
      id: "o-readback",
      kind: "single",
      prompt: "What is the most useful thing a manager can do with a fortnight of opening and closing records?",
      options: [
        "File them in case of an inspection",
        "Read them back and look for the task that never gets ticked and the unit that keeps coming up",
        "Count how many were logged",
        "Check who signed each one",
      ],
      correct: [1],
      why: "Filed and unread, the log is only insurance. Read back, it tells you which job is not actually happening and which piece of equipment is on its way out.",
    },
    {
      id: "o-whocan",
      kind: "single",
      prompt: "Who should be doing the opening and closing checks?",
      options: [
        "Only the general manager",
        "Whoever is opening or closing that day, as long as they have been shown the list and what to do when something fails",
        "Only the head chef",
        "Whoever has time at the end of the week",
      ],
      correct: [1],
      why: "The routine belongs to the shift, not to one job title. What makes it work is that the person doing it knows the list and knows who to tell.",
    },
    {
      id: "o-list-change",
      kind: "single",
      prompt: "The same note keeps appearing on your closing records: a door that needs two attempts to latch. What should happen to the list?",
      options: [
        "Nothing — the note is doing its job",
        "Add checking that door as its own line, so it is checked deliberately rather than remembered",
        "Remove the note to keep the record tidy",
        "Replace the whole list",
      ],
      correct: [1],
      why: "A checklist should describe this building. A recurring note is the venue telling you that something needs to be a task rather than a memory.",
    },
    {
      id: "o-notachecklist",
      kind: "single",
      prompt: "Does a completed opening checklist mean the venue is compliant for the day?",
      options: [
        "Yes, that is the point of it",
        "No — it is one routine and one piece of evidence, and it does not replace temperature records, cleaning, training or anything else",
        "Yes, if a manager signs it",
        "Only if every task is ticked",
      ],
      correct: [1],
      why: "The checklist covers what it covers. Treating it as a blanket sign-off for the day is how the things that are not on it stop happening.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Questions built from the venue's own records
// --------------------------------------------------------------------------- //

/**
 * Venue questions, derived only from opening and closing records the venue
 * actually saved. A venue with no records gets questions about what an empty
 * log means, which is the honest lesson for that venue rather than a quiz about
 * checks that never happened.
 */
export function openCloseQuestions(
  records: CourseCleaningRecord[],
  seed: number
): QuizQuestion[] {
  const rows = openClose(records);

  if (rows.length === 0) {
    return [
      {
        id: "ov-empty",
        kind: "single",
        prompt:
          "No opening or closing checklists have ever been logged here. What does that empty record actually prove?",
        options: [
          "That the venue is not being opened and closed properly",
          "Nothing about how well it is done — but it means nobody can show what was checked, or spot the task that keeps getting skipped",
          "Nothing at all, so it does not matter",
          "That these checks are not needed in this venue",
        ],
        correct: [1],
        why: "An empty log is not evidence of a badly run venue. It is the absence of evidence of a well run one, and it also means nobody can read a pattern back.",
      },
      {
        id: "ov-empty-why",
        kind: "single",
        prompt:
          "Opening and closing here get done but do not get logged. Why is the log worth the minute it takes?",
        options: [
          "Because a tick is what an inspector wants to see",
          "Because it is the only thing that can show later what was checked, and reading it back is how the venue finds the job nobody is doing",
          "Because writing it down makes the walk more thorough",
          "It is not worth it if the checks are being done anyway",
        ],
        correct: [1],
        why: "Nobody can go back and inspect last Tuesday. The record is the only version of last Tuesday that exists, and a fortnight of them shows the pattern nobody notices in the moment.",
      },
    ];
  }

  const out: QuizQuestion[] = [];
  const lastOpen = latestOf(rows, OPEN);
  const lastClose = latestOf(rows, CLOSE);

  // 1. The sharpest lesson available: a part-ticked list saved as a pass.
  const partial = bestPartial(rows);
  if (partial) {
    out.push({
      id: `ov-open-partial-${partial.id}`,
      kind: "single",
      prompt: `Your most recent ${partial.label.toLowerCase()} record has ${partial.tickedCount} of the ${partial.expectedCount} tasks on the list ticked, and it saved as "${partial.status}". What does that record tell somebody reading it back?`,
      note: "This is your own venue's recorded data.",
      options: [
        `That the ${partial.label.toLowerCase()} were completed`,
        "That either most of the list was skipped, or it was done and not ticked — and nobody can tell which",
        "Nothing — the status is what counts",
        "That the venue failed the check that day",
      ],
      correct: [1],
      why: `A record is evidence of what was done. ${partial.tickedCount} of ${partial.expectedCount} ticked and saved as a pass leaves a reader unable to tell a skipped list from a badly filled-in one, and both are worth fixing.`,
    });
  } else {
    const newest = latestAny(rows)!;
    out.push({
      id: `ov-full-${newest.id}`,
      kind: "single",
      prompt: `Your opening and closing records here have the full list ticked, including the ${newest.label.toLowerCase()} logged ${niceDate(newest.checkedAt)}. What can a complete record still not show?`,
      note: "This is your own venue's recorded data.",
      options: [
        "Nothing — a full set of ticks proves the checks were done",
        "Whether each tick was earned, which comes down to the honesty of whoever filled it in",
        "Which member of staff logged it",
        "Whether the equipment was working",
      ],
      correct: [1],
      why: "A full set of ticks is the right shape, and it is worth exactly what the person filling it in made it worth. That is why an honest gap with a note beats an invented tick.",
    });
  }

  // 2. The closing record specifically — the end of the day is the one that slips.
  if (lastClose && (!partial || partial.id !== lastClose.id)) {
    out.push({
      id: `ov-close-${lastClose.id}`,
      kind: "single",
      prompt: `Your last closing check was logged ${niceDate(lastClose.checkedAt)} with ${lastClose.tickedCount} of ${lastClose.expectedCount} tasks ticked. Which two jobs on a closing list cause the most damage when they are the ones missed?`,
      note: "This is your own venue's recorded data.",
      options: [
        "Sweeping the floor and wiping the pass",
        "Food stored, covered and cooled properly, and equipment isolated so nothing runs unattended",
        "Cashing up and locking the office",
        "Restocking the bar and polishing glassware",
      ],
      correct: [1],
      why: "Food left out or put away hot is a food safety problem by morning, and equipment left running in an empty building is the classic overnight fire. Everything else on the list is recoverable.",
    });
  }

  // 3. One of the two routines is logged and the other is not.
  if (lastOpen && !lastClose) {
    out.push({
      id: `ov-noclose-${rows.length}`,
      kind: "single",
      prompt:
        "Your venue logs opening checks but has never logged a closing check. What is the right reading of that?",
      note: "This is your own venue's recorded data.",
      options: [
        "Nothing — the opening check covers the same ground",
        "Either the closing round is happening and not being recorded, or it is not happening, and a manager needs to know which",
        "Log the missing closing checks retrospectively so the record is complete",
        "Closing checks matter less than opening checks",
      ],
      correct: [1],
      why: "A routine nobody has ever logged is either invisible work or missing work. Backfilling it is a false record, so the honest move is to say something now.",
    });
  } else if (lastClose && !lastOpen) {
    out.push({
      id: `ov-noopen-${rows.length}`,
      kind: "single",
      prompt:
        "Your venue logs closing checks but has never logged an opening check. Why does the missing one matter?",
      note: "This is your own venue's recorded data.",
      options: [
        "It does not — the closing check covers the same ground",
        "Because the opening walk is the only thing that catches what changed overnight, before service depends on it",
        "Because inspectors only look at opening checks",
        "Because it makes the closing records invalid",
      ],
      correct: [1],
      why: "A perfect close does not tell you whether a fridge failed at 4am. Only the morning walk does, and only before anybody preps from that fridge.",
    });
  }

  // 4. When the log has gone quiet, the gap is its own question.
  const newest = latestAny(rows)!;
  const gap = daysAgo(newest.checkedAt);
  if (gap > 7) {
    out.push({
      id: `ov-stale-${gap}`,
      kind: "single",
      prompt: `The most recent opening or closing record here is from ${niceDate(newest.checkedAt)} — ${agoPhrase(newest.checkedAt)}. What does the gap since then mean?`,
      note: "This is your own venue's recorded data.",
      options: [
        "The venue stopped opening and closing properly on that date",
        "The routine has almost certainly carried on, but there is no record of any of it since then",
        "The records were deleted",
        "Nothing — the older records still cover it",
      ],
      correct: [1],
      why: "A log that stops does not mean the checks stopped. It means everything since that date is undocumented, so none of it can be shown to anybody who asks.",
    });
  }

  return shuffled(out, seed + 5);
}

// --------------------------------------------------------------------------- //
// Paper
// --------------------------------------------------------------------------- //

/**
 * Build the paper. Venue questions first, topped up from the knowledge bank.
 *
 * The floor of 8 knowledge questions means a venue with a long checklist
 * history still gets a course about opening and closing a building rather than
 * a quiz about its own paperwork.
 */
export function openCloseQuiz(
  records: CourseCleaningRecord[],
  seed: number
): QuizQuestion[] {
  const fromRecords = openCloseQuestions(records, seed);
  const wanted = 12;
  const knowledge = shuffled(openCloseBank(), seed).slice(
    0,
    Math.max(8, wanted - fromRecords.length)
  );
  return shuffled([...fromRecords, ...knowledge], seed + 29);
}
