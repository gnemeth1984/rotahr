/**
 * Working time, breaks & rest — in-house course content.
 *
 * Same rules as every other course in this folder: employer-delivered awareness
 * training, NOT an accredited qualification, and never presented as employment
 * law advice or as a substitute for a contract, a union rep or a solicitor.
 *
 * This subject is more jurisdiction-dependent than food temperatures. The EU
 * floor is the Working Time Directive (2003/88/EC); Ireland implements it
 * through the Organisation of Working Time Act 1997; the UK has its own
 * Working Time Regulations 1998 with an individual opt-out that Ireland does
 * not have; the US has no federal break entitlement at all and leaves it to
 * the states. So every figure in this course is introduced as the figure in
 * common use in Ireland and the EU, with an explicit instruction to check the
 * local rule. Never let a later edit state one of these numbers flatly.
 *
 * The venue data this course reads is the rota and the time clock. It reads
 * both as SHAPE ONLY — counts, lengths, gaps, totals. No employee name ever
 * reaches a lesson or a question. "Tommy worked 11 hours with no break" printed
 * on a page every colleague opens, and then frozen into the stored completion
 * snapshot forever, would be handing out a grievance rather than teaching.
 * See CourseShift and CourseClock in kit.ts.
 */

import {
  type CourseClock,
  type CourseShift,
  type Lesson,
  type QuizQuestion,
  niceDate,
  shuffled,
} from "./kit";

// --------------------------------------------------------------------------- //
// Small helpers
// --------------------------------------------------------------------------- //

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** "8 hours", "11 hours 30 minutes". Rounded to the nearest 15 minutes. */
function hoursText(h: number): string {
  const q = Math.round(h * 4) / 4;
  const whole = Math.floor(q);
  const mins = Math.round((q - whole) * 60);
  if (whole === 0) return `${mins} minutes`;
  const hPart = `${whole} ${plural(whole, "hour", "hours")}`;
  return mins === 0 ? hPart : `${hPart} ${mins} minutes`;
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
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d === -1) return "tomorrow";
  if (d < 0) return `in ${Math.abs(d)} days`;
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `about ${Math.round(d / 7)} weeks ago`;
  return `about ${Math.round(d / 30)} months ago`;
}

// --------------------------------------------------------------------------- //
// Rota shape
// --------------------------------------------------------------------------- //

interface Shape {
  total: number;
  people: number;
  published: number;
  unpublished: number;
  /** Rostered 6 hours or more — the longer break threshold in most of Europe. */
  over6: number;
  /** Rostered 4.5 up to 6 hours — the shorter break threshold in Ireland. */
  band45: number;
  under45: number;
  longest: number;
  longestDate: string | null;
  totalHours: number;
  overtime: number;
  /** Same person, shift to shift, with less than 11 hours between them. */
  shortGaps: number;
  shortestGap: number | null;
  shortestGapDate: string | null;
  /** Longest run of consecutive calendar days worked by one person. */
  maxStreak: number;
  /** Most hours one person is rostered inside any rolling 7-day window. */
  maxWeek: number;
}

const DAILY_REST = 11;

function shapeOf(shifts: CourseShift[]): Shape {
  const byPerson = new Map<string, CourseShift[]>();
  for (const s of shifts) {
    const key = s.employeeId ?? "unassigned";
    const list = byPerson.get(key);
    if (list) list.push(s);
    else byPerson.set(key, [s]);
  }

  let longest = 0;
  let longestDate: string | null = null;
  let totalHours = 0;
  let overtime = 0;
  for (const s of shifts) {
    totalHours += s.hours;
    overtime += s.overtimeHours;
    if (s.hours > longest) {
      longest = s.hours;
      longestDate = s.date;
    }
  }

  let shortGaps = 0;
  let shortestGap: number | null = null;
  let shortestGapDate: string | null = null;
  let maxStreak = 0;
  let maxWeek = 0;

  for (const [key, list] of byPerson) {
    if (key === "unassigned") continue;
    const sorted = [...list].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // Turnaround between one shift finishing and the next one starting.
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = new Date(sorted[i - 1].endTime).getTime();
      const nextStart = new Date(sorted[i].startTime).getTime();
      const gap = (nextStart - prevEnd) / 3600000;
      if (gap < 0) continue; // overlapping rows are a rota error, not a rest question
      if (gap < DAILY_REST) {
        shortGaps++;
        if (shortestGap === null || gap < shortestGap) {
          shortestGap = gap;
          shortestGapDate = sorted[i].date;
        }
      }
    }

    // Consecutive calendar days.
    const days = Array.from(
      new Set(sorted.map((s) => new Date(s.date).toISOString().slice(0, 10)))
    ).sort();
    let run = days.length ? 1 : 0;
    for (let i = 1; i < days.length; i++) {
      const a = new Date(days[i - 1] + "T00:00:00Z").getTime();
      const b = new Date(days[i] + "T00:00:00Z").getTime();
      if (Math.round((b - a) / 86400000) === 1) run++;
      else run = 1;
      if (run > maxStreak) maxStreak = run;
    }
    if (run > maxStreak) maxStreak = run;

    // Heaviest rolling seven days.
    for (let i = 0; i < sorted.length; i++) {
      const from = new Date(sorted[i].startTime).getTime();
      const to = from + 7 * 86400000;
      let sum = 0;
      for (let j = i; j < sorted.length; j++) {
        if (new Date(sorted[j].startTime).getTime() >= to) break;
        sum += sorted[j].hours;
      }
      if (sum > maxWeek) maxWeek = sum;
    }
  }

  return {
    total: shifts.length,
    people: Array.from(byPerson.keys()).filter((k) => k !== "unassigned").length,
    published: shifts.filter((s) => s.published).length,
    unpublished: shifts.filter((s) => !s.published).length,
    over6: shifts.filter((s) => s.hours >= 6).length,
    band45: shifts.filter((s) => s.hours >= 4.5 && s.hours < 6).length,
    under45: shifts.filter((s) => s.hours > 0 && s.hours < 4.5).length,
    longest,
    longestDate,
    totalHours: Math.round(totalHours),
    overtime: Math.round(overtime * 10) / 10,
    shortGaps,
    shortestGap: shortestGap === null ? null : Math.round(shortestGap * 100) / 100,
    shortestGapDate,
    maxStreak,
    maxWeek: Math.round(maxWeek * 10) / 10,
  };
}

// --------------------------------------------------------------------------- //
// Knowledge lessons
// --------------------------------------------------------------------------- //

const knowledgeLessons: Lesson[] = [
  {
    id: "what-working-time-is",
    title: "What counts as working time",
    body: [
      "Working time is not the same thing as time spent serving customers. The test used across Europe is broader: you are working when you are at the employer's disposal, at your place of work, carrying out your duties. That covers a lot of hospitality time that people are used to treating as unpaid goodwill.",
      "The handover briefing before doors open is working time. Cashing up after the last table leaves is working time. Cleaning down, closing checks, waiting at the premises because the delivery is late, a mandatory team meeting on your day off, and travel between two venues in the middle of a shift are all normally working time.",
      "The other side of the line matters just as much. Commuting from home to your usual workplace is generally not working time. A genuine break, where you are free to leave and nobody expects you to answer the pass, is generally not working time — which is exactly why a break spent standing at the bar 'just in case' does not count as a break at all.",
      "The exact boundary is one of the most argued questions in European employment law, and standby, sleep-in and on-call arrangements have all been fought over repeatedly. Where a situation is genuinely borderline, the contract and the rule in your own country decide it, not a course page.",
    ],
    keyPoint:
      "If you are at the venue, under instruction, and not free to leave, treat it as working time and make sure it is recorded.",
  },
  {
    id: "breaks",
    title: "Breaks",
    body: [
      "In Ireland the figures in common use come from the Organisation of Working Time Act 1997: a 15-minute break once you have worked more than four and a half hours, and a 30-minute break once you have worked more than six — and the 30 can include the 15 you already had. In the UK and much of the EU the equivalent figure is a single 20-minute break once the working day exceeds six hours. These are not the same rule, and neither is universal.",
      "A break has to actually be a break. If you are eating standing at the pass while watching a section, or you have your radio on, or the expectation is that you will step back the moment it gets busy, that is not rest. It is unpaid working time, which is a worse problem than a missed break.",
      "Two things people get wrong constantly. First, a break generally cannot be traded for money in Ireland — paying somebody an extra 15 minutes instead of letting them sit down does not discharge the duty. Second, a break is meant to break up the shift. Letting somebody finish 30 minutes early instead of taking a break in the middle of a ten-hour double is not compliance, even when the person prefers it.",
      "Where you work, check the local rule and the exact figures. What travels everywhere is the principle: long shifts get rest, the rest has to be real, and it has to happen during the shift.",
    ],
    keyPoint:
      "A break you cannot walk away from is not a break. The figures vary by country; the requirement that rest be genuine does not.",
  },
  {
    id: "daily-rest",
    title: "Daily rest, and the shift pattern that breaks it",
    body: [
      "The common European figure for daily rest is 11 consecutive hours in every 24. It is the least understood rule in hospitality and the one broken most often, usually by accident, usually by a rota built around cover rather than around people.",
      "The pattern has a name in the trade: the close-open. Somebody finishes at one in the morning after cash-up, then opens at nine. That is eight hours between shifts. Take off travel each way, and it is closer to six hours of actual sleep. It is a rest breach, it is a food safety risk, and it is the single most common reason good staff leave a venue that they otherwise like.",
      "It is a rota problem, not a person problem, and it is nearly always visible before it happens. The fix is to check turnarounds while the week is still a draft — before the rota is published and before somebody has told their family what their week looks like.",
      "Some places allow compensatory rest where the gap is unavoidable, on conditions. Do not assume that applies to you, and do not use it as a routine way to build a week.",
    ],
    keyPoint:
      "Close-then-open is the classic breach. Count the hours between the end of one shift and the start of the next while the rota is still a draft.",
  },
  {
    id: "weekly-rest",
    title: "The weekly picture: days off and the average week",
    body: [
      "On top of daily rest, the common European position is 24 uninterrupted hours of weekly rest, normally taken alongside the 11 hours of daily rest — which in practice means about 35 hours off in a row. Some regimes allow two 24-hour periods across a fortnight instead. In Ireland, Sunday work also usually attracts a premium on top, either in pay or in time off.",
      "Then there is the maximum average working week. The figure in common use across the EU is 48 hours, averaged over a reference period that is commonly four months. Averaging is the part people miss in both directions. One 58-hour week during a festival is not automatically unlawful. A steady diet of 55-hour weeks through a whole season is, and the fact that everybody was willing does not fix it.",
      "This is also where the countries genuinely differ rather than just using different numbers. The UK allows an individual to opt out of the 48-hour average in writing. Ireland does not have that individual opt-out at all. So advice copied from a British source can be flatly wrong in an Irish kitchen, and vice versa.",
      "For a manager the practical version is simple: look at the season, not the week. If somebody has been over 48 hours for six weeks running, the average is already the problem and no single week is going to fix it.",
    ],
    keyPoint:
      "The weekly maximum is an average over months, not a cap on one week — and whether a person can waive it depends entirely on where you are.",
  },
  {
    id: "young-workers",
    title: "Anyone under 18 is on a different set of rules",
    body: [
      "Hospitality employs more teenagers than almost any other sector — the glass collector, the weekend kitchen porter, the Saturday runner. Young workers are covered by a separate and stricter regime, and applying the adult rules to them is one of the easiest serious breaches to commit without noticing.",
      "In Ireland the Protection of Young Persons (Employment) Act 1996 sets lower daily and weekly maximums for 16- and 17-year-olds, longer breaks, and limits on late-night work — with tighter limits again for under-16s, and restrictions during school term. Other countries set their own figures, but the shape is always the same: shorter days, more rest, no late finishes.",
      "The practical traps are predictable. Keeping a 17-year-old on until close because the venue is slammed. Rostering them across a school week as if it were a holiday week. Treating a written parental consent, where one is required, as if it lifted the hour limits. It does not.",
      "If you are rostering somebody under 18, look up the rule that applies where you are before you publish, every time. Do not work from what the venue did last summer.",
    ],
    keyPoint:
      "Under-18s are never on the adult limits. Check the age on the file before you build the rota, not after somebody complains.",
  },
  {
    id: "records",
    title: "Records — the part that protects the venue",
    body: [
      "Every regime that sets working time limits also requires the employer to keep records showing them being met. In Ireland the requirement is to keep records of hours worked, and of days and hours of annual leave and public holidays, and to retain them — three years is the commonly cited period. Inspectors ask for them, and they ask without notice.",
      "Here is the part worth understanding properly, because it is what turns record-keeping from admin into self-defence. Where an employer cannot produce records, the burden of proof commonly shifts onto the employer. A former employee says they worked 55 hours a week for eight months with no breaks. Without records, the venue is arguing about memory, and the account that stands is usually not the venue's.",
      "This is why the time clock matters more than it looks. A break that was genuinely taken but never recorded is, for evidential purposes, a break that was not taken. Nobody remembers a Tuesday in March. The clock does.",
      "Records also work in the other direction, and that is worth saying to staff plainly: they are the only thing that proves the hours you actually did when a payslip is wrong.",
    ],
    keyPoint:
      "No record commonly means the employer loses the argument. Clocking in, clocking out and recording the break is evidence, not bureaucracy.",
  },
  {
    id: "extra-hours",
    title: "Overtime, doubles and 'can you just stay on'",
    body: [
      "Extra hours count. A double picked up as a favour, an hour of overtime after a wedding, the shift you covered because somebody rang in sick — all of it goes into the same average as the rostered hours, and all of it should be recorded. Hours worked off the record do not stop existing; they just stop being provable.",
      "'Voluntary' is not a defence on its own. In most European regimes the duty to stay inside the limits sits on the employer, and consent from a willing employee does not discharge it — in Ireland, as above, there is not even an individual opt-out to sign. Somebody enthusiastically working themselves into the ground is still the venue's problem.",
      "Two adjacent points that come up constantly in hospitality. Many places now require that a contract reflect the hours somebody genuinely works, so a person on eight hours a week who has actually done thirty every week for months can often ask to be moved to a band that matches. And unpaid trial shifts, where the person is doing real productive work under instruction, are working time in most regimes regardless of what they are called.",
      "The figures and the mechanisms here vary a lot between countries. Treat this lesson as a prompt to check, not as a statement of your local law.",
    ],
    keyPoint:
      "If the hours were worked, record them. Willingness does not move the duty off the employer.",
  },
  {
    id: "raising-it",
    title: "When it is not happening",
    body: [
      "If breaks are not happening, or turnarounds are too short, raise it early and in writing — a message to the manager is enough, and it creates the record that a conversation in a corridor does not. Most of these problems are rota mistakes rather than decisions, and they are cheap to fix in a draft and expensive to fix in a grievance.",
      "If it continues, every regime has an external route: a labour inspectorate, a commission, a tribunal. In Ireland that is the Workplace Relations Commission. You do not need to have exhausted anything internally to use it, and there are time limits, so raising it sooner protects the option.",
      "Penalising somebody for asserting a statutory entitlement is itself generally unlawful — losing shifts, being moved to the worst sections, or a sudden change in tone after somebody asks for their break. If that happens it becomes a second, more serious problem for the venue, separate from the original one.",
      "For managers, the honest framing: this is a retention issue before it is a legal one. Nobody hands in notice citing Article 3 of a directive. They hand in notice because they have done six ten-hour days in a row and they are done.",
    ],
    keyPoint:
      "Raise it in writing and early. Retaliating against somebody for asking for a legal entitlement turns a rota mistake into a much bigger case.",
  },
];

// --------------------------------------------------------------------------- //
// Venue lessons — the venue's own rota and clock
// --------------------------------------------------------------------------- //

export function rotaLesson(shifts: CourseShift[]): Lesson {
  const s = shapeOf(shifts);

  if (s.total === 0) {
    return {
      id: "your-rota",
      title: "Your own rota",
      body: [
        "There are no shifts on the rota for this venue yet, so there is nothing here to measure. That is worth using rather than skipping past.",
        "Every rest problem in this course is easiest to solve at exactly this point — before the first week is built, while the pattern is still a choice. Once a venue has run the same close-open turnaround for six months, it stops looking like a breach and starts looking like the way things are done here.",
        "So the two habits to start with are these. Build the week, then read it back looking only at the gaps between shifts for each person. And put the hours on the record from the first shift, because the record is what protects the venue later.",
      ],
      keyPoint:
        "A rota with nothing in it is the cheapest time to decide how you are going to check turnarounds and record hours.",
    };
  }

  const body: string[] = [];

  body.push(
    `This rota holds ${s.total} ${plural(s.total, "shift", "shifts")} across ${
      s.people
    } ${plural(s.people, "person", "people")}, ${
      s.totalHours
    } rostered hours in total. Everything below is read from those rows — no names, just the shape of the week.`
  );

  body.push(
    `${s.over6} of those ${plural(
      s.over6,
      "shift is",
      "shifts are"
    )} six hours or longer, and ${s.band45} ${plural(
      s.band45,
      "sits",
      "sit"
    )} between four and a half and six. In Ireland that first group carries the 30-minute break entitlement and the second carries the 15-minute one; in the UK and much of the EU the single trigger is a working day over six hours. Either way, a shift on this list being over six hours means a break has to happen inside it, not at the end of it.`
  );

  if (s.longestDate) {
    body.push(
      `The longest single shift here is ${hoursText(s.longest)}, on ${niceDate(
        s.longestDate
      )} (${agoPhrase(s.longestDate)}). A shift that length is not unlawful by itself, but it only works if the rest inside it is real — and it is exactly the kind of shift where a break gets quietly skipped because the section is busy.`
    );
  }

  if (s.shortGaps > 0 && s.shortestGap !== null) {
    body.push(
      `Now the number worth stopping on. On ${s.shortGaps} ${plural(
        s.shortGaps,
        "occasion",
        "occasions"
      )} on this rota, somebody's next shift starts less than 11 hours after their last one finished. The tightest turnaround is ${hoursText(
        s.shortestGap
      )}${
        s.shortestGapDate ? `, into ${niceDate(s.shortestGapDate)}` : ""
      }. Eleven consecutive hours is the common European daily rest figure, so each of those is worth a look — and none of them needed to happen, because every one of them was visible in the draft.`
    );
  } else {
    body.push(
      "One good sign: nowhere on this rota does somebody's next shift start less than 11 hours after their last one finished. That is the daily rest figure in common use across Europe, and clearing it consistently is harder in hospitality than in almost any other sector. It is worth checking again every time the week is built, because it is the first thing that slips when somebody rings in sick."
    );
  }

  if (s.maxStreak >= 6) {
    body.push(
      `One person on this rota is rostered ${s.maxStreak} calendar days in a row. Weekly rest — commonly 24 uninterrupted hours, usually taken with the 11 hours of daily rest attached — is the rule that a run like that runs into, and a fortnight's averaging does not always rescue it.`
    );
  }

  if (s.maxWeek >= 48) {
    body.push(
      `The heaviest seven days for one person on this rota comes to ${s.maxWeek} rostered hours. The 48-hour maximum in common use across the EU is an average over a reference period, commonly four months, so a single week above it is not automatically a breach — but it is the point at which somebody should be watching the average rather than the week.`
    );
  } else if (s.maxWeek > 0) {
    body.push(
      `The heaviest seven days for one person here comes to ${s.maxWeek} rostered hours, which sits under the 48-hour average figure used across the EU. Worth remembering that the limit is an average over months, so what matters is the run of weeks, not this one.`
    );
  }

  if (s.unpublished > 0) {
    body.push(
      `${s.unpublished} of these ${plural(
        s.unpublished,
        "shift is",
        "shifts are"
      )} still unpublished. That is the right moment to check the gaps: a draft can be moved by 20 minutes with nobody noticing, whereas a published rota has already been screenshotted and sent to somebody's family.`
    );
  }

  if (s.overtime > 0) {
    body.push(
      `There ${plural(
        s.overtime,
        "is",
        "are"
      )} also ${s.overtime} recorded overtime ${plural(
        s.overtime,
        "hour",
        "hours"
      )} attached to these shifts. Overtime counts towards the same average as rostered time, which is precisely why it is worth recording rather than absorbing.`
    );
  }

  return {
    id: "your-rota",
    title: "Your own rota",
    body,
    keyPoint:
      s.shortGaps > 0
        ? "The tight turnarounds above were all visible before the rota was published. Reading the gaps while the week is a draft costs nothing."
        : "Read the gaps between each person's shifts every time the week is built. It is the first thing that slips when somebody calls in sick.",
  };
}

export function clockLesson(clock: CourseClock, shifts: CourseShift[]): Lesson {
  const s = shapeOf(shifts);
  const events = clock.ins + clock.outs + clock.breakStarts + clock.breakEnds;

  if (events === 0) {
    return {
      id: "your-clock",
      title: "Your own time records",
      body: [
        "Nobody has clocked in or out at this venue yet — the time clock holds no events at all.",
        s.total > 0
          ? `That sits awkwardly beside the rota, which holds ${s.total} ${plural(
              s.total,
              "shift",
              "shifts"
            )}. A rostered shift is a plan. A clock event is evidence. If somebody disputed their hours for one of those shifts, there would be nothing to produce beyond the plan and somebody's memory.`
          : "There is no rota either, so there is nothing missing yet — but the habit is worth starting with the first shift rather than the hundredth.",
        "Every working time regime that sets limits also requires the employer to keep records of hours actually worked, commonly retained for around three years. And where records do not exist, the burden of proof usually shifts onto the employer: the venue ends up arguing about memory, and memory is not evidence.",
        "The clock is the cheapest compliance tool in the building. It takes four seconds a shift and it is the only thing that answers an inspector, or a wrong payslip, without an argument.",
      ],
      keyPoint:
        "A shift with no clock event is a shift you cannot prove. Records are what protect both the venue and the person.",
    };
  }

  const body: string[] = [];

  body.push(
    `The time clock here holds ${clock.ins} clock-${plural(
      clock.ins,
      "in",
      "ins"
    )} and ${clock.outs} clock-${plural(clock.outs, "out", "outs")}${
      clock.latest ? `, the most recent ${agoPhrase(clock.latest)}` : ""
    }. Those events are the venue's working time records — the thing an inspector asks for and the thing that settles a query about a payslip.`
  );

  if (clock.ins > clock.outs) {
    const open = clock.ins - clock.outs;
    body.push(
      `${open} clock-${plural(open, "in has", "ins have")} no matching clock-out. Some of that is people currently on shift, which is normal. The rest is the familiar hospitality ending: the place got busy, the shift ran over, and nobody closed it off. An unclosed shift has no recorded finish time, which means it has no recorded length either — so it proves nothing about the hours actually worked.`
    );
  }

  if (clock.breakStarts === 0) {
    body.push(
      `The number to look at is this one: no breaks have ever been recorded here. Not a single break start. Meanwhile ${
        s.over6
      } ${plural(
        s.over6,
        "shift on the rota is",
        "shifts on the rota are"
      )} six hours or longer, which is the length that carries a break entitlement in Ireland, the UK and across the EU.`
    );
    body.push(
      "That does not mean nobody is taking breaks — in a real kitchen people usually are. It means the breaks are not evidenced. And for the purposes of an inspection or a complaint, an unrecorded break is treated much the same as a break that never happened, because there is nothing to produce. This is the cheapest gap in the building to close: the clock page has a break button, and using it takes two taps."
    );
  } else if (clock.breakStarts > clock.breakEnds) {
    const openBreaks = clock.breakStarts - clock.breakEnds;
    body.push(
      `${clock.breakStarts} ${plural(
        clock.breakStarts,
        "break has",
        "breaks have"
      )} been recorded, but ${openBreaks} of them ${plural(
        openBreaks,
        "was",
        "were"
      )} never ended. A break with a start and no finish has no recorded length, so it does not evidence the 15 or 30 minutes it was meant to prove. Ending the break matters as much as starting it.`
    );
  } else {
    body.push(
      `${clock.breakStarts} ${plural(
        clock.breakStarts,
        "break has",
        "breaks have"
      )} been recorded and closed properly. That is genuinely unusual — most venues never record a single one — and it is the part of the record that is hardest to reconstruct later, so it is worth keeping up.`
    );
  }

  return {
    id: "your-clock",
    title: "Your own time records",
    body,
    keyPoint:
      clock.breakStarts === 0
        ? "An unrecorded break cannot be evidenced, and where records are missing the burden of proof usually falls on the employer. Two taps closes that gap."
        : "Clock in, clock out, and close the break. An event with no end has no length, and a length is the whole point of the record.",
  };
}

export function workingTimeLessons(
  shifts: CourseShift[],
  clock: CourseClock
): Lesson[] {
  const knowledge: Lesson[] = [...knowledgeLessons];
  return [...knowledge, rotaLesson(shifts), clockLesson(clock, shifts)];
}

// --------------------------------------------------------------------------- //
// Knowledge questions
// --------------------------------------------------------------------------- //

export function workingTimeBank(): QuizQuestion[] {
  return [
    {
      id: "wt-definition",
      kind: "multi",
      prompt: "Which of these would normally count as working time?",
      note: "Select all that apply.",
      options: [
        "Cashing up and cleaning down after the last table leaves",
        "The handover briefing before doors open",
        "Your commute from home to your usual workplace",
        "Travelling between two of the company's venues in the middle of a shift",
      ],
      correct: [0, 1, 3],
      why: "Working time is time at the employer's disposal carrying out duties — which includes cash-up, briefings and inter-venue travel during a shift. The ordinary commute to your usual workplace generally is not.",
    },
    {
      id: "wt-break-real",
      kind: "single",
      prompt:
        "A chef eats standing at the pass, radio on, and steps back onto the section twice during the 20 minutes. Was that a break?",
      options: [
        "Yes — they got 20 minutes and food",
        "No — they were never free to step away, so it is working time rather than rest",
        "Yes, as long as it was unpaid",
        "It depends whether they asked for a break",
      ],
      correct: [1],
      why: "Rest has to be genuine. Time where you are still at the employer's disposal is working time, which is a worse outcome than a missed break — the venue now has unrecorded hours as well.",
    },
    {
      id: "wt-break-figures",
      kind: "single",
      prompt:
        "Which statement about break entitlements is safest to work from across different countries?",
      options: [
        "20 minutes after six hours applies everywhere",
        "15 minutes after four and a half hours applies everywhere",
        "The exact figures differ by country, so check the local rule — but long shifts require genuine rest during the shift everywhere it is regulated",
        "There is no legal break entitlement anywhere; it is down to the contract",
      ],
      correct: [2],
      why: "Ireland uses 15 minutes after 4.5 hours and 30 after 6; the UK and much of the EU use a single 20 minutes once the day exceeds 6. The US has no federal entitlement at all. The principle travels, the numbers do not.",
    },
    {
      id: "wt-break-buyout",
      kind: "single",
      prompt:
        "A manager offers to pay an extra 30 minutes instead of the member of staff taking a break. In Ireland, does that discharge the duty?",
      options: [
        "Yes — paying for the time is the same thing",
        "No — the entitlement is to rest, and generally cannot be traded for pay",
        "Yes, if the employee agrees in writing",
        "Only if the venue is short-staffed that day",
      ],
      correct: [1],
      why: "The entitlement is to actual rest. Money instead of a break does not satisfy it, and the employee's agreement does not move the duty.",
    },
    {
      id: "wt-break-timing",
      kind: "single",
      prompt:
        "Instead of a break in the middle of a ten-hour double, somebody is let finish 30 minutes early. Is that compliance?",
      options: [
        "Yes — they got the time back",
        "No — a break is meant to break up the shift, so time off the end is not the same thing",
        "Yes, if the employee preferred it",
        "Yes, as long as it is recorded",
      ],
      correct: [1],
      why: "The point of a break is rest during the working period. An early finish, however welcome, does not provide rest inside a ten-hour shift.",
    },
    {
      id: "wt-daily-rest",
      kind: "single",
      prompt:
        "What is the daily rest figure in common use across the EU, between finishing one shift and starting the next?",
      options: [
        "8 consecutive hours",
        "11 consecutive hours",
        "12 consecutive hours",
        "There is no daily rest figure — only a weekly one",
      ],
      correct: [1],
      why: "11 consecutive hours in every 24 is the common figure. Local implementations vary in the detail, and some allow compensatory rest in defined circumstances.",
    },
    {
      id: "wt-clopen",
      kind: "single",
      prompt:
        "Somebody finishes at 01:00 after cash-up and is rostered to open at 09:00. What is the problem?",
      options: [
        "Nothing — eight hours is enough for anyone",
        "It is only a pay problem, not a rest problem",
        "It is an eight-hour turnaround, short of the 11-hour daily rest figure, and after travel it is closer to six hours of sleep",
        "It is fine as long as the person volunteered",
      ],
      correct: [2],
      why: "The close-open is the most common daily rest breach in hospitality. It is also a food safety and retention problem, and it is visible in the draft rota before anyone is affected.",
    },
    {
      id: "wt-when-to-check",
      kind: "single",
      prompt: "When is the right moment to check turnarounds between shifts?",
      options: [
        "At the end of the month, when hours are totalled for payroll",
        "While the week is still a draft, before the rota is published",
        "Only if somebody complains",
        "At the annual review",
      ],
      correct: [1],
      why: "A draft can be moved by 20 minutes with nobody noticing. A published rota has already been sent to somebody's family, and changing it costs goodwill.",
    },
    {
      id: "wt-weekly-rest",
      kind: "single",
      prompt: "What is the common European position on weekly rest?",
      options: [
        "24 uninterrupted hours, normally taken together with the 11 hours of daily rest",
        "Two full weekends off per month",
        "48 hours off every week without exception",
        "There is no weekly rest requirement",
      ],
      correct: [0],
      why: "24 uninterrupted hours is the usual figure, commonly attached to the daily rest so it works out around 35 hours in a row. Some regimes allow two 24-hour periods across a fortnight instead.",
    },
    {
      id: "wt-48-average",
      kind: "single",
      prompt:
        "A member of staff worked 58 hours during a festival week. Is that automatically unlawful?",
      options: [
        "Yes — 48 hours is a hard weekly cap",
        "No — the 48-hour figure is an average over a reference period, commonly four months, so one heavy week can be lawful",
        "Yes, unless they were paid overtime",
        "No, because the 48-hour figure only applies to salaried staff",
      ],
      correct: [1],
      why: "Averaging cuts both ways: one busy week can be fine, while a whole season of 55-hour weeks is a breach even though no single week looks dramatic.",
    },
    {
      id: "wt-optout",
      kind: "single",
      prompt:
        "Advice found online says an employee can sign a form to opt out of the 48-hour average week. Can you rely on that in Ireland?",
      options: [
        "Yes — the opt-out is an EU-wide mechanism",
        "No — the UK has an individual opt-out but Ireland does not, so British advice can be flatly wrong here",
        "Yes, as long as it is witnessed",
        "Only for managers",
      ],
      correct: [1],
      why: "This is one of the places countries genuinely differ rather than just using different numbers. Always check which regime a source is written for.",
    },
    {
      id: "wt-consent",
      kind: "single",
      prompt:
        "A keen new employee keeps volunteering for extra doubles and is well over the limits. Whose problem is that?",
      options: [
        "Theirs — they chose it",
        "Nobody's, while they are happy",
        "The employer's — the duty to stay inside the limits sits on the employer, and consent generally does not discharge it",
        "The other staff's, for not covering",
      ],
      correct: [2],
      why: "In most European regimes the obligation is on the employer. Willingness does not move it, and in Ireland there is not even an individual opt-out to sign.",
    },
    {
      id: "wt-young",
      kind: "single",
      prompt:
        "A 17-year-old glass collector is rostered on the same terms as the adult staff, finishing at closing time. What is wrong with that?",
      options: [
        "Nothing, as long as a parent consented",
        "Under-18s are covered by a stricter regime — lower daily and weekly maximums, longer breaks and limits on late-night work",
        "Nothing, as long as they are paid the adult rate",
        "Only the pay rate needs checking",
      ],
      correct: [1],
      why: "Young workers are never on the adult limits, and parental consent does not lift the hour or late-night restrictions. Check the age on the file before publishing.",
    },
    {
      id: "wt-young-school",
      kind: "single",
      prompt:
        "Which of these is a common feature of rules for workers under 18?",
      options: [
        "Tighter limits during school term",
        "A higher weekly maximum than adults",
        "No break entitlement",
        "Permission to work later than adults",
      ],
      correct: [0],
      why: "The pattern is consistently shorter days, more rest and no late finishes, with additional restrictions during school term. The exact figures vary by country.",
    },
    {
      id: "wt-records-duty",
      kind: "single",
      prompt: "Who is responsible for keeping records of hours worked?",
      options: [
        "Each employee, in their own notes",
        "The employer",
        "Nobody — records are optional",
        "The payroll provider only",
      ],
      correct: [1],
      why: "Every regime that sets working time limits puts the record-keeping duty on the employer, with a retention period attached — three years is the figure commonly cited in Ireland.",
    },
    {
      id: "wt-records-burden",
      kind: "single",
      prompt:
        "A former employee claims eight months of 55-hour weeks with no breaks. The venue kept no records. What usually happens?",
      options: [
        "The claim fails for lack of evidence",
        "The burden of proof commonly shifts onto the employer, so the employee's account is likely to stand",
        "Both sides are assumed to be equally right",
        "The case cannot proceed at all",
      ],
      correct: [1],
      why: "This is the practical reason records matter. Without them the venue is arguing about memory, and the account that stands is usually not the venue's.",
    },
    {
      id: "wt-unrecorded-break",
      kind: "single",
      prompt:
        "Breaks are genuinely being taken at a venue, but nobody records them. How does that stand up to an inspection or a complaint?",
      options: [
        "Fine — the staff can confirm it",
        "Poorly — an unrecorded break is treated much like a break that never happened, because there is nothing to produce",
        "Fine, as long as the rota shows the shift lengths",
        "It is irrelevant; only hours are inspected",
      ],
      correct: [1],
      why: "Nobody remembers a Tuesday in March. If the break is not recorded, there is nothing to hand over, and the venue is back to arguing about memory.",
    },
    {
      id: "wt-unclosed",
      kind: "single",
      prompt:
        "Somebody clocks in but never clocks out because the place got busy. What is the consequence?",
      options: [
        "None — the rota shows the planned finish time",
        "The shift has no recorded finish, so it has no recorded length and proves nothing about hours actually worked",
        "The system will assume eight hours",
        "It only affects that person's pay, not the venue's records",
      ],
      correct: [1],
      why: "A record with no end has no length, and length is the entire point of the record. Closing the shift matters as much as opening it.",
    },
    {
      id: "wt-overtime-counts",
      kind: "single",
      prompt:
        "An hour of overtime after a wedding, and a double picked up as a favour. Do they count towards the working time average?",
      options: [
        "No — only rostered hours count",
        "Yes — all hours worked count, and all of them should be recorded",
        "Only if they were paid at a premium rate",
        "Only if the employee asks for them to count",
      ],
      correct: [1],
      why: "Hours worked off the record do not stop existing; they just stop being provable — which helps nobody, least of all the venue.",
    },
    {
      id: "wt-trial-shift",
      kind: "single",
      prompt:
        "A candidate does a four-hour unpaid trial shift on a busy Friday, working a section under instruction. How is that usually treated?",
      options: [
        "As unpaid recruitment, outside working time",
        "As working time in most regimes, because they were doing real productive work under instruction",
        "As training, which is never working time",
        "It depends entirely on what the advert called it",
      ],
      correct: [1],
      why: "What the arrangement is called does not decide it. Real productive work under instruction is generally working time regardless of the label.",
    },
    {
      id: "wt-banded",
      kind: "single",
      prompt:
        "Somebody contracted for eight hours a week has actually worked about thirty every week for months. What is often available to them?",
      options: [
        "Nothing — the contract is the contract",
        "In many places, the right to be placed on a band of hours that reflects what they genuinely work",
        "Automatic promotion to full-time management",
        "A refund of tax",
      ],
      correct: [1],
      why: "Several regimes now require the contract to reflect reality. The detail varies, so check the local rule — but a contract that is years out of date is a live risk.",
    },
    {
      id: "wt-raise",
      kind: "single",
      prompt: "Breaks are not happening on your section. What is the best first step?",
      options: [
        "Say nothing and hope the next rota is better",
        "Raise it with the manager in writing, early — a message is enough, and it creates a record",
        "Go straight to a solicitor",
        "Stop working until it is fixed",
      ],
      correct: [1],
      why: "Most of these problems are rota mistakes rather than decisions, and they are cheap to fix in a draft. Writing it down creates the record a corridor conversation does not.",
    },
    {
      id: "wt-retaliation",
      kind: "single",
      prompt:
        "After somebody asks for their break entitlement, they start losing shifts and getting the worst sections. What is that?",
      options: [
        "A normal management decision",
        "Penalisation for asserting a statutory entitlement — generally unlawful in itself, and a second and more serious problem for the venue",
        "Acceptable, if the rota was already drafted",
        "Only a problem if it is in writing",
      ],
      correct: [1],
      why: "Retaliation for asserting a legal entitlement is treated separately from the original breach, and it is usually the more expensive of the two.",
    },
    {
      id: "wt-not-accredited",
      kind: "single",
      prompt: "What is this course, in employment law terms?",
      options: [
        "A recognised employment law qualification",
        "In-house awareness training delivered by your employer — not legal advice and not a qualification",
        "Confirmation that this venue is compliant with working time law",
        "A substitute for your contract of employment",
      ],
      correct: [1],
      why: "It is employer-delivered awareness training. Where the figures matter to a real decision, check the rule that applies where you work, and take advice.",
    },
    {
      id: "wt-jurisdiction",
      kind: "single",
      prompt:
        "Why does this course keep saying to check the local rule instead of just giving one number?",
      options: [
        "Because the numbers are secret",
        "Because working time law is set nationally — break triggers, opt-outs and young worker limits genuinely differ between countries",
        "Because the rules change every month",
        "Because the numbers do not really matter",
      ],
      correct: [1],
      why: "The EU directive sets a floor and each country implements it differently, and outside the EU the picture differs again. Quoting one figure as universal is how venues get this wrong.",
    },
    {
      id: "wt-manager-view",
      kind: "single",
      prompt:
        "From a manager's point of view, what usually goes wrong first when somebody does six ten-hour days in a row?",
      options: [
        "An inspection",
        "A tribunal claim",
        "They hand in their notice — it is a retention problem before it is a legal one",
        "Nothing, if they are paid correctly",
      ],
      correct: [2],
      why: "Nobody resigns citing a directive. They resign because they are exhausted, and replacing them costs far more than fixing the rota did.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Venue questions — asked against this venue's own rota and clock
// --------------------------------------------------------------------------- //

export function rotaQuestions(
  shifts: CourseShift[],
  clock: CourseClock,
  seed: number
): QuizQuestion[] {
  const s = shapeOf(shifts);
  const out: QuizQuestion[] = [];
  const events = clock.ins + clock.outs + clock.breakStarts + clock.breakEnds;

  // 1. Empty rota — teach the habit rather than a figure.
  if (s.total === 0) {
    out.push({
      id: "wt-empty",
      kind: "single",
      prompt:
        "There are no shifts on this venue's rota yet. When is the cheapest moment to build in rest checks?",
      options: [
        "After the first complaint",
        "Now, before the first week is built — while the pattern is still a choice",
        "Once there are enough staff to matter",
        "At the first inspection",
      ],
      correct: [1],
      why: "Once a venue has run the same close-open turnaround for six months it stops looking like a breach and starts looking like the way things are done here.",
    });
    out.push({
      id: "wt-empty-record",
      kind: "single",
      prompt:
        "With no rota and no clock records at this venue yet, what should start with the very first shift?",
      options: [
        "Nothing — records only matter once there are enough of them",
        "Recording the hours worked, because the record is what protects the venue if the hours are ever disputed",
        "A signed waiver from each employee",
        "A printed rota on the wall only",
      ],
      correct: [1],
      why: "Where records do not exist the burden of proof commonly shifts onto the employer. That is true of the first shift as much as the thousandth.",
    });
    return shuffled(out, seed + 13);
  }

  // 2. Their own break-threshold count.
  if (s.over6 > 0) {
    out.push({
      id: `wt-over6-${s.over6}-of-${s.total}`,
      kind: "single",
      prompt: `${s.over6} of the ${s.total} ${plural(
        s.total,
        "shift",
        "shifts"
      )} on this rota ${plural(
        s.over6,
        "is",
        "are"
      )} six hours or longer. What does that length trigger?`,
      options: [
        "Overtime pay",
        "A break entitlement that has to be met during the shift, not paid off or given as an early finish",
        "A second member of staff on the section",
        "Nothing in particular",
      ],
      correct: [1],
      why: "Six hours is the threshold that carries the longer break in Ireland and the single 20-minute break in the UK and much of the EU. The figures differ; the requirement to rest during the shift does not.",
    });
  }

  // 3. Their own tightest turnaround — the sharpest question in the course.
  if (s.shortGaps > 0 && s.shortestGap !== null) {
    out.push({
      id: `wt-gap-${s.shortGaps}-shortest-${Math.round(s.shortestGap)}`,
      kind: "single",
      prompt: `On this rota, ${s.shortGaps} ${plural(
        s.shortGaps,
        "turnaround gives",
        "turnarounds give"
      )} somebody less than 11 hours between finishing and starting again — the tightest being ${hoursText(
        s.shortestGap
      )}. What is that?`,
      options: [
        "Normal for hospitality and not worth reviewing",
        "A daily rest problem: 11 consecutive hours is the common European figure, and each of these was visible while the rota was still a draft",
        "Only a problem if the person complains",
        "A pay issue rather than a rest issue",
      ],
      correct: [1],
      why: "The close-open is the most common working time breach in the trade, and the cheapest to fix — before the week is published.",
    });
  } else {
    out.push({
      id: `wt-gap-clear-${s.total}`,
      kind: "single",
      prompt: `No turnaround on this rota drops below 11 hours between shifts. Why is that worth re-checking every week rather than assuming it holds?`,
      options: [
        "Because the law changes weekly",
        "Because cover changes: the gap is the first thing that slips when somebody rings in sick and a shift is reassigned",
        "Because published rotas cannot be edited",
        "It is not worth re-checking once it is clear",
      ],
      correct: [1],
      why: "Rest breaches are rarely designed in. They arrive with the sick call, the swap and the last-minute cover.",
    });
  }

  // 4. Their longest single shift.
  if (s.longest >= 8 && s.longestDate) {
    out.push({
      id: `wt-longest-${Math.round(s.longest)}`,
      kind: "single",
      prompt: `The longest shift on this rota is ${hoursText(
        s.longest
      )}, on ${niceDate(s.longestDate)}. Is a shift that length unlawful in itself?`,
      options: [
        "Yes — no shift may exceed eight hours",
        "No — but the rest inside it has to be real, and it is exactly the shift where a break gets quietly skipped",
        "Yes, unless overtime is paid",
        "No, and no break is needed on a single long shift",
      ],
      correct: [1],
      why: "Length alone is not the breach. The breach is the shift running that long with no genuine rest inside it, and no record that any was taken.",
    });
  }

  // 5. Consecutive days worked by one person.
  if (s.maxStreak >= 6) {
    out.push({
      id: `wt-streak-${s.maxStreak}`,
      kind: "single",
      prompt: `One person on this rota is rostered ${s.maxStreak} calendar days in a row. Which rule does a run like that run into?`,
      options: [
        "The break entitlement",
        "Weekly rest — commonly 24 uninterrupted hours, usually taken with the 11 hours of daily rest attached",
        "The young worker rules",
        "None; consecutive days are unregulated",
      ],
      correct: [1],
      why: "Weekly rest is the rule long runs breach, and fortnightly averaging does not always rescue it. It is also the pattern that precedes a resignation.",
    });
  }

  // 6. Their heaviest rolling week.
  if (s.maxWeek >= 40) {
    out.push({
      id: `wt-week-${Math.round(s.maxWeek)}`,
      kind: "single",
      prompt: `The heaviest seven days for one person on this rota comes to ${s.maxWeek} rostered hours. How should that be read against the 48-hour figure?`,
      options: [
        "As a hard weekly cap that must never be exceeded",
        "As an average over a reference period, commonly four months — so the run of weeks matters more than this one",
        "As irrelevant, since it only applies to salaried staff",
        "As a target to aim for",
      ],
      correct: [1],
      why: "Averaging is the part people miss in both directions: one heavy festival week can be lawful, while a whole season of 55-hour weeks is not.",
    });
  }

  // 7. Draft versus published.
  if (s.unpublished > 0) {
    out.push({
      id: `wt-draft-${s.unpublished}`,
      kind: "single",
      prompt: `${s.unpublished} ${plural(
        s.unpublished,
        "shift on this rota is",
        "shifts on this rota are"
      )} still unpublished. Why does that matter for rest checks?`,
      options: [
        "Unpublished shifts do not count towards working time",
        "Because a draft can still be moved by 20 minutes with nobody noticing, whereas a published rota has already been sent to somebody's family",
        "Because unpublished shifts are unpaid",
        "It does not matter either way",
      ],
      correct: [1],
      why: "The gap check is nearly free before publication and expensive afterwards. That is the whole argument for doing it in the draft.",
    });
  }

  // 8. Clock records — the strongest evidence question, asked from their own numbers.
  if (events === 0) {
    out.push({
      id: `wt-clock-none-${s.total}`,
      kind: "single",
      prompt: `This venue has ${s.total} rostered ${plural(
        s.total,
        "shift",
        "shifts"
      )} and no clock events at all. What is the practical consequence?`,
      options: [
        "None — the rota is the record",
        "There is no evidence of hours actually worked, and where records are missing the burden of proof commonly falls on the employer",
        "Payroll will estimate the hours",
        "It only matters if there is an inspection",
      ],
      correct: [1],
      why: "A rostered shift is a plan. A clock event is evidence. Only one of them is any use when somebody disputes their hours.",
    });
  } else if (clock.breakStarts === 0) {
    out.push({
      id: `wt-nobreaks-${clock.ins}-ins`,
      kind: "single",
      prompt: `This venue has recorded ${clock.ins} clock-${plural(
        clock.ins,
        "in",
        "ins"
      )} and not one break. What does that mean for the venue?`,
      options: [
        "Nothing — staff can confirm breaks were taken",
        "Breaks may well be happening, but none are evidenced — and an unrecorded break is treated much like a break that never happened",
        "That breaks are not required here",
        "That the clock is broken",
      ],
      correct: [1],
      why: "It is the cheapest gap in the building to close: the clock page has a break button, and using it is two taps.",
    });
  } else {
    out.push({
      id: `wt-breaks-${clock.breakStarts}-${clock.breakEnds}`,
      kind: "single",
      prompt: `${clock.breakStarts} break ${plural(
        clock.breakStarts,
        "start",
        "starts"
      )} and ${clock.breakEnds} break ${plural(
        clock.breakEnds,
        "end",
        "ends"
      )} are recorded here. Why does ending the break matter as much as starting it?`,
      options: [
        "It does not — the start proves the break happened",
        "Because a break with no recorded end has no recorded length, so it cannot evidence the 15 or 30 minutes it was meant to prove",
        "Because the system charges for open breaks",
        "Because only completed breaks are paid",
      ],
      correct: [1],
      why: "Length is the entire point of the record. An event with a start and no finish evidences nothing.",
    });
  }

  // 9. Unclosed shifts, from their own numbers.
  if (clock.ins > clock.outs) {
    const open = clock.ins - clock.outs;
    out.push({
      id: `wt-open-${open}`,
      kind: "single",
      prompt: `${open} clock-${plural(
        open,
        "in here has",
        "ins here have"
      )} no matching clock-out. Setting aside anyone currently on shift, what is the problem with an unclosed shift?`,
      options: [
        "It looks untidy in the log",
        "It has no recorded finish time, so it has no recorded length and proves nothing about the hours worked",
        "It doubles the recorded hours",
        "Nothing — payroll fills the gap",
      ],
      correct: [1],
      why: "The familiar hospitality ending: the place got busy, the shift ran over, nobody closed it off. The hours were worked but they are no longer provable.",
    });
  }

  return shuffled(out, seed + 13);
}

/**
 * Build the paper. Venue questions first, then knowledge to a floor of 8, and
 * top up to 12 — same shape as every other course in the library.
 */
export function workingTimeQuiz(
  shifts: CourseShift[],
  clock: CourseClock,
  seed: number
): QuizQuestion[] {
  const mine = rotaQuestions(shifts, clock, seed);
  const wanted = 12;
  const knowledge = shuffled(workingTimeBank(), seed).slice(
    0,
    Math.max(8, wanted - mine.length)
  );
  return shuffled([...mine, ...knowledge], seed + 37);
}
