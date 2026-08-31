/**
 * Stock, waste and food cost control — in-house course content.
 *
 * Same rules as every other course in this folder: employer-delivered awareness
 * training, never an accredited qualification, and every benchmark figure
 * hedged as "widely used" rather than stated as fact.
 *
 * ── Why this one is different ───────────────────────────────────────────────
 * Every other course in the library is about a rule — hygiene, allergens, fire,
 * working time, data. This one is about money. Nothing here is a legal duty and
 * the copy should never pretend otherwise. It exists because food and beverage
 * cost is the difference between a venue that survives and one that does not,
 * and because a venue that already logs its waste in Rotahr is sitting on the
 * exact data needed to teach it.
 *
 * ── The venue data it reads ─────────────────────────────────────────────────
 * Two sources, two different jobs, same split as the front-of-house course.
 *
 * The stock list (CourseStock) feeds the GRADED questions. Stock ids already
 * ride on the quiz ticket for any usesStock course, so the paper rebuilds
 * identically at submit time.
 *
 * The waste log (CourseWastage) feeds LESSONS ONLY and is never carried on the
 * ticket. A waste line can be logged, corrected or deleted while somebody is
 * mid-course, so grading against it would be grading against a moving target.
 *
 * ── What must never appear here ─────────────────────────────────────────────
 * Never who logged a waste line. toCourseWastage drops recordedBy and reads the
 * detail field as presence only, and the reason is in its doc comment: the
 * moment a cost course reads like a blame sheet, staff stop logging waste and
 * the venue loses the only data it has about where the margin went.
 *
 * And do not re-teach food-hygiene-awareness. Rotation, date labelling and FIFO
 * appear here only as a cost consequence. The hygiene rule is taught there.
 */

import {
  type CourseStock,
  type CourseWastage,
  type Lesson,
  type QuizQuestion,
  niceDate,
  shuffled,
  wasteCauseLabel,
  wasteReasonLabel,
} from "./kit";

// --------------------------------------------------------------------------- //
// Small helpers
// --------------------------------------------------------------------------- //

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Money, in the venue's own currency symbol. Never a rounded-off guess. */
function money(n: number, sym: string): string {
  return `${sym}${n.toFixed(2)}`;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function daysAgo(iso: string): number {
  const then = new Date(iso);
  then.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - then.getTime()) / 86400000);
}

function spanPhrase(days: number): string {
  if (days <= 1) return "a single day";
  if (days <= 9) return `${days} days`;
  if (days <= 45) return `about ${Math.round(days / 7)} weeks`;
  return `about ${Math.round(days / 30)} months`;
}

// --------------------------------------------------------------------------- //
// What the course works out about the venue before it says anything
// --------------------------------------------------------------------------- //

interface ReasonRoll {
  code: string;
  n: number;
  cost: number;
}

interface ItemRoll {
  name: string;
  n: number;
  cost: number;
}

interface Shape {
  /** Stock list */
  items: number;
  priced: number;
  unpriced: number;
  withPar: number;
  noPar: number;
  atOrBelow: CourseStock[];
  dearest: CourseStock | null;
  /** A priced line with a pack size, good for the portion-cost arithmetic. */
  divisible: CourseStock | null;
  categories: number;
  /** Waste log */
  wasteLines: number;
  wasteCost: number;
  wasteDays: number;
  newest: string | null;
  oldest: string | null;
  byReason: ReasonRoll[];
  byItem: ItemRoll[];
  blankReasons: number;
  uncosted: number;
  withDetail: number;
}

function shape(stock: CourseStock[], wastage: CourseWastage[]): Shape {
  const priced = stock.filter((s) => s.packPrice !== null && s.packPrice > 0);
  const withPar = stock.filter((s) => s.reorderLevel !== null && s.reorderLevel > 0);
  const atOrBelow = stock.filter((s) => s.atOrBelow);

  let dearest: CourseStock | null = null;
  for (const s of priced) {
    if (!dearest || (s.packPrice ?? 0) > (dearest.packPrice ?? 0)) dearest = s;
  }

  // A line that can carry the pack-price-into-portion-cost sum: priced, and
  // with a pack size somebody actually recorded. Prefer the biggest pack.
  let divisible: CourseStock | null = null;
  for (const s of priced) {
    if (!s.packSize || s.packSize <= 1) continue;
    if (!divisible || (s.packSize ?? 0) > (divisible.packSize ?? 0)) divisible = s;
  }

  const reasonMap = new Map<string, ReasonRoll>();
  const itemMap = new Map<string, ItemRoll>();
  let wasteCost = 0;
  let blankReasons = 0;
  let uncosted = 0;
  let withDetail = 0;
  let newest: string | null = null;
  let oldest: string | null = null;

  for (const w of wastage) {
    const cost = w.totalCost ?? 0;
    wasteCost += cost;
    if (w.totalCost === null) uncosted += 1;
    if (w.hasNotes) withDetail += 1;

    const code = w.reason || "";
    if (!code) blankReasons += 1;
    const key = code || "other";
    const r = reasonMap.get(key) ?? { code: key, n: 0, cost: 0 };
    r.n += 1;
    r.cost += cost;
    reasonMap.set(key, r);

    const i = itemMap.get(w.itemName) ?? { name: w.itemName, n: 0, cost: 0 };
    i.n += 1;
    i.cost += cost;
    itemMap.set(w.itemName, i);

    if (!newest || w.date > newest) newest = w.date;
    if (!oldest || w.date < oldest) oldest = w.date;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    items: stock.length,
    priced: priced.length,
    unpriced: stock.length - priced.length,
    withPar: withPar.length,
    noPar: stock.length - withPar.length,
    atOrBelow,
    dearest,
    divisible,
    categories: new Set(stock.map((s) => s.category)).size,
    wasteLines: wastage.length,
    wasteCost: round2(wasteCost),
    wasteDays: newest && oldest ? Math.max(1, daysAgo(oldest) - daysAgo(newest) + 1) : 0,
    newest,
    oldest,
    byReason: [...reasonMap.values()]
      .map((r) => ({ ...r, cost: round2(r.cost) }))
      .sort((a, b) => b.cost - a.cost || b.n - a.n),
    byItem: [...itemMap.values()]
      .map((i) => ({ ...i, cost: round2(i.cost) }))
      .sort((a, b) => b.cost - a.cost || b.n - a.n),
    blankReasons,
    uncosted,
    withDetail,
  };
}

// --------------------------------------------------------------------------- //
// Lessons
// --------------------------------------------------------------------------- //

function whyLesson(sym: string): Lesson {
  return {
    id: "sc-why",
    title: "Why a euro of waste is not a euro",
    body: [
      "Hospitality runs on thin margins, and almost all of the money that goes missing goes missing quietly. Not through theft or a bad month, but through a case that went out of date, a tray of prep nobody sold, a keg line that was never checked and a portion that has slowly grown by twenty grams.",
      `Here is the arithmetic that makes it matter. If food costs you roughly 30 percent of what you charge, then every ${money(
        100,
        sym
      )} of stock you throw away has to be replaced by about ${money(
        333,
        sym
      )} of extra sales just to get back to where you were. Waste does not come off the food cost of a dish. It comes off the profit at the bottom, which is usually the smallest number on the page.`,
      "Widely used benchmarks put food cost somewhere around 28 to 35 percent of food sales and beverage cost around 20 to 25 percent, but those are starting points for a conversation, not targets handed down from anywhere. Your own venue's numbers are the only ones that count, and the point of this course is that you already have most of them.",
    ],
    bullets: [
      "Gross profit is what you charge minus what the stock cost you, before wages, rent or anything else.",
      "Waste is paid for out of profit, so it needs several times its own value in extra sales to cover it.",
      "The cheapest margin you will ever win is the stock you were going to throw out anyway.",
    ],
    keyPoint:
      "You do not need to sell more to earn more this week. Not throwing money in the bin does the same job faster.",
  };
}

function listLesson(s: Shape, sym: string): Lesson {
  const body: string[] = [];

  if (s.items === 0) {
    body.push(
      "Your stock list is empty. That is worth saying plainly, because everything else in this course gets easier once it is not: without a priced list there is no cost price to value waste at, no par level to order against, and no way to tell a bad week from a normal one."
    );
    body.push(
      "You do not need to build it in one go. Start with the twenty lines that carry the most money — the proteins, the spirits, the kegs, the cheese, the oil — put the last invoice price on each, and the list starts paying for itself immediately."
    );
  } else {
    body.push(
      `Your list has ${s.items} ${plural(s.items, "line", "lines")} on it across ${
        s.categories
      } ${plural(s.categories, "category", "categories")}, and ${s.priced} of ${
        s.items
      } ${plural(s.priced, "carries", "carry")} a price.`
    );

    if (s.dearest && s.dearest.packPrice !== null) {
      body.push(
        `The most expensive single pack on your list is ${s.dearest.name} at ${money(
          s.dearest.packPrice,
          sym
        )}. Lines like that are where the attention belongs: getting a cheap line perfect saves pennies, and getting an expensive line slightly wrong costs real money every single week.`
      );
    }

    if (s.unpriced > 0) {
      body.push(
        `${s.unpriced} ${plural(
          s.unpriced,
          "line has no price on it",
          "lines have no price on them"
        )}. An unpriced line cannot be costed when it is wasted, so it drops silently out of every total the venue looks at. Put the last invoice figure on it — approximately right beats missing.`
      );
    }

    body.push(
      "The number on the invoice is the pack price, and the pack price is not what a portion costs you. That second figure is the one that decides whether a dish makes money, and it is the pack price divided by how many usable portions the pack actually yields — after trim, after peel, after the loss in cooking."
    );

    if (s.divisible && s.divisible.packPrice !== null && s.divisible.packSize) {
      const unit = s.divisible.packUnit || s.divisible.unit;
      const per = s.divisible.packPrice / s.divisible.packSize;
      body.push(
        `Worked on one of your own lines: ${s.divisible.name} costs ${money(
          s.divisible.packPrice,
          sym
        )} for ${s.divisible.packSize} ${unit}, so one ${unit} is about ${money(
          per,
          sym
        )} before any trim loss. Take 20 percent off in trim and it is roughly ${money(
          per / 0.8,
          sym
        )} per usable ${unit}. That is the figure a portion should be costed at, not the first one.`
      );
    }
  }

  return {
    id: "sc-list",
    title: "Reading your own stock list",
    body,
    bullets: [
      "Pack price is what you paid. Portion cost is what a plate uses. They are never the same number.",
      "Yield loss is real: trim, peel, bones, cooking loss and the last inch of the bottle.",
      "Price your biggest-value lines first. That is where the money actually is.",
    ],
    keyPoint:
      "Every line without a price is a line the venue cannot see. Get a figure on it, even an approximate one.",
  };
}

function reasonsLesson(): Lesson {
  return {
    id: "sc-reasons",
    title: "The reason beside the number is the lesson",
    body: [
      "A waste total tells you that you are losing money, which you already knew. The reason column tells you which problem to fix, and they are completely different problems with completely different answers.",
      "Rotahr's own wastage log guidance puts it like this: two hundred euro of waste in a week caused by over-prep is a forecasting problem; the same figure caused by spoilage is a rotation or ordering problem; caused by returns, it is a kitchen consistency problem. Same number, three different fixes, and no way to tell them apart without the code.",
      "That is also why comps and staff food belong under their own codes rather than being bundled into food waste. Bundled, they hide each other — you cannot see whether you have a kitchen problem or a service problem.",
    ],
    bullets: [
      "Out of date points at ordering and rotation. You bought more than you could sell in time.",
      "Spoiled points at storage, temperature or handling. It went off before its date.",
      "Over-prepped points at forecasting. Prep quantities set by habit rather than by expected covers.",
      "Spilled or broken points at handling and training, and often at how a task is set up.",
      "Prep trim points at specification and butchery skill — the yield question, not the bin question.",
      "Sent back points at consistency or portioning on one section.",
      "Comped points at service recovery, not the kitchen at all.",
    ],
    keyPoint:
      "Never log waste without a reason. A line with no reason is a cost you have recorded and learned nothing from.",
  };
}

function logLesson(s: Shape, sym: string): Lesson {
  const body: string[] = [];

  if (s.wasteLines === 0) {
    body.push(
      "Your waste log has nothing in it yet. In a working kitchen and bar that does not mean nothing was wasted — it means nothing was recorded, which is the harder problem, because it leaves the venue guessing about the biggest controllable cost it has."
    );
    body.push(
      "Start it where the waste happens, not in the office. Log the item, the quantity, the reason code and what it cost, as it goes in the bin. A week of honest lines is enough to show you where the money is going; a month is enough to prove whether a change worked."
    );
  } else {
    const top = s.byItem[0];
    const topReason = s.byReason[0];
    body.push(
      `Your log has ${s.wasteLines} ${plural(
        s.wasteLines,
        "line",
        "lines"
      )} on it, totalling ${money(s.wasteCost, sym)} over ${spanPhrase(
        s.wasteDays
      )}, with the most recent entry on ${niceDate(s.newest)}.`
    );

    if (top && top.cost > 0) {
      const share = pct(top.cost, s.wasteCost);
      body.push(
        `${top.name} accounts for ${money(top.cost, sym)} of that — ${share} percent of everything you have logged, from ${
          top.n
        } ${plural(top.n, "line", "lines")}. That is what waste almost always looks like when you actually measure it: not spread evenly, but concentrated in one or two expensive lines. Which is good news, because it means one conversation about one item is worth more than a general appeal to be careful.`
      );
    }

    if (topReason) {
      body.push(
        `The biggest reason by value is "${wasteReasonLabel(topReason.code)}" at ${money(
          topReason.cost,
          sym
        )}. That points at ${wasteCauseLabel(
          topReason.code
        )} — so that is the thing to change this week, and next week's log is how you find out whether the change worked.`
      );
    }

    if (s.blankReasons > 0) {
      body.push(
        `${s.blankReasons} ${plural(
          s.blankReasons,
          "line has no reason code on it",
          "lines have no reason code on them"
        )}. Those are costs you have paid for twice: once in stock, and once in the lesson you did not get.`
      );
    }

    if (s.uncosted > 0) {
      body.push(
        `${s.uncosted} ${plural(s.uncosted, "line is", "lines are")} logged without a cost, so ${plural(
          s.uncosted,
          "it is",
          "they are"
        )} missing from the total above. The real figure is higher than the one on this page.`
      );
    }
  }

  return {
    id: "sc-log",
    title: "What your own waste log already says",
    body,
    bullets: [
      "Log it at the bin, as it happens. A log filled in from memory at the end of the shift is fiction.",
      "Cost it at cost price, never menu price. Menu price inflates it and makes it easy to dismiss.",
      "An unrealistically clean waste log means people are binning quietly, not that nothing is wasted.",
    ],
    keyPoint:
      "Nobody is in trouble for logging waste. People get in trouble for hiding it, because then it cannot be fixed.",
  };
}

function parLesson(s: Shape, sym: string): Lesson {
  const body: string[] = [
    "A par level is the amount of a line you want on the shelf at the start of a normal week, and a reorder point is the level at which you order more. Between them they replace the two habits that cost the most money: ordering by feel, and ordering in a panic.",
    "Over-ordering is the expensive one, and it does not look like a mistake at the time. It looks like being well stocked. Then the delivery arrives on top of stock that has not moved, the oldest cases end up at the back, and three weeks later somebody logs it as out of date.",
  ];

  if (s.items === 0) {
    body.push(
      "You have no stock lines yet, so there is nothing to set a par level against. When you build the list, set a reorder level on the lines you would never want to run out of — that is what makes the list start doing work for you rather than just recording things."
    );
  } else if (s.withPar === 0) {
    body.push(
      `None of your ${s.items} ${plural(
        s.items,
        "line",
        "lines"
      )} has a reorder level set, so nothing can warn you before it runs out. Setting them is a one-off job: for each line, roughly how much do you get through in the time it takes an order to arrive, plus a little for a busy weekend. That figure is the reorder level.`
    );
  } else {
    body.push(
      `${s.withPar} of your ${s.items} ${plural(
        s.items,
        "line",
        "lines"
      )} ${plural(s.withPar, "has", "have")} a reorder level set.`
    );

    if (s.atOrBelow.length > 0) {
      const names = s.atOrBelow.slice(0, 4).map((i) => i.name).join(", ");
      body.push(
        `Right now ${s.atOrBelow.length} ${plural(
          s.atOrBelow.length,
          "line is",
          "lines are"
        )} at or below that level: ${names}${
          s.atOrBelow.length > 4 ? ", and others" : ""
        }. That is not a crisis, it is the system working — it is telling you what goes on the next order before a section runs dry mid-service.`
      );
    } else {
      body.push(
        "Nothing is at or below its reorder level at the moment. Worth a sanity check, though: a list where nothing ever hits its reorder point usually means the levels were set too low to be useful, or the counts are not being kept up to date."
      );
    }

    if (s.noPar > 0) {
      body.push(
        `${s.noPar} ${plural(s.noPar, "line has", "lines have")} no reorder level. Start with the ones you would refuse to run out of on a Saturday night.`
      );
    }
  }

  body.push(
    `Running out has a cost too, and it is easy to underestimate. A dish taken off mid-service is a lost sale, a slower table and a guest who ordered their second choice. That is why the answer is a level and a count, not "order plenty".`
  );

  return {
    id: "sc-par",
    title: "Par levels, reorder points and the cost of both mistakes",
    body,
    bullets: [
      "Reorder level = what you use in the lead time, plus a small buffer for a busy day.",
      "Over-ordering shows up later as spoilage. It never shows up as over-ordering.",
      "Count before you order. An order placed off a guess is a guess with an invoice attached.",
    ],
    keyPoint: `Every line at or below its reorder level is a decision waiting to be made. Ignoring it is also a decision.`,
  };
}

function rotationLesson(s: Shape, sym: string): Lesson {
  const expiry = s.byReason.find((r) => r.code === "expiry" || r.code === "spoilage");
  const body: string[] = [
    "Rotation is taught as a hygiene rule, and it is one — that part is covered properly in the food hygiene course. What gets missed is that it is also the cheapest cost control in the building, and it costs nothing to do except attention.",
    "Oldest at the front, newest behind it, every delivery, every time. The whole discipline is that one sentence. It gets broken in the same way every time: a delivery arrives during service, there is nowhere to put it, so it goes in front of what is already there. Nothing is visibly wrong that day. Three weeks later the stock at the back is out of date and somebody logs it.",
    "The same applies to labelling. A prep container with no date on it becomes a judgement call, and judgement calls under pressure go one of two expensive ways: it gets thrown away when it was fine, or it gets used when it was not.",
  ];

  if (expiry && expiry.cost > 0) {
    body.push(
      `On your own log, "${wasteReasonLabel(expiry.code)}" alone accounts for ${money(
        expiry.cost,
        sym
      )}. That is the number rotation and ordering actually move, and it is the easiest money in this course to get back.`
    );
  }

  return {
    id: "sc-rotation",
    title: "Rotation, dates and labels as cost control",
    body,
    bullets: [
      "Put the delivery away properly, even when the timing is terrible. Especially then.",
      "Date every prep container. Undated stock gets binned early or used late, and both cost you.",
      "Check the short-dated shelf before you write an order, not after the delivery arrives.",
    ],
    keyPoint:
      "Stock that goes out of date was bought, carried, stored and then paid for a second time to have it taken away.",
  };
}

function portionLesson(s: Shape, sym: string): Lesson {
  const keg = s.atOrBelow.some((i) => i.keg);
  const body: string[] = [
    "Portion drift is the quietest cost in hospitality. Nobody decides to serve more; portions simply grow, a little at a time, because a generous plate feels like good service and nobody is measuring. Ten grams extra on a protein served two hundred times a week is a real number by the end of the month, and it never appears on any waste log.",
    "The fix is a written specification and something to measure with. Scales on the prep bench, a jigger or a metered pour behind the bar, the same ladle for the same sauce, a photograph of the finished plate so a new starter can see what right looks like rather than guessing.",
    "It cuts both ways, and that matters when you explain it to a team. A portion that shrinks costs you a guest; a portion that grows costs you the margin. Consistency is the actual goal — the guest gets what the menu promised and the venue gets what it priced.",
  ];

  if (keg) {
    body.push(
      "Draught is the sharpest example. A keg holds a fixed number of pints and every over-pour, every line flush that was not needed and every pint poured to waste to clear a foamy line comes straight off the yield. The stock system says you have a keg; what you actually have is a keg minus whatever the bar has been giving away."
    );
  }

  return {
    id: "sc-portion",
    title: "Portion control, yield and the drift nobody notices",
    body,
    bullets: [
      "A recipe without a written portion size is not a recipe, it is a suggestion.",
      "Measure the expensive components. Nobody needs to weigh the garnish.",
      "Yield is part of cost: what you paid divided by what you can actually serve.",
      "Free pours and unmetered spirits are the fastest way to lose beverage margin.",
    ],
    keyPoint:
      "Portion drift never shows up in the bin, so the waste log will never catch it. Only a spec and a scale will.",
  };
}

function habitsLesson(s: Shape, sym: string): Lesson {
  const body: string[] = [
    "None of this works as a one-off push. It works as a weekly rhythm that takes under an hour, and it is the same four steps every week.",
    "Count. Cost. Compare. Change one thing. Then check next week whether the change did anything, and only then move on to the next problem. Fixing one code properly beats a general instruction to be careful, which has never once worked in any kitchen.",
    "A waste figure with no comparison is noise. The number that gets attention is the same figure expressed as a share of sales for the same period, because that is the number that tells you whether last month's fix held.",
  ];

  if (s.wasteLines > 0 && s.byReason[0]) {
    body.push(
      `For you, this week, that means the "${wasteReasonLabel(
        s.byReason[0].code
      )}" code and ${
        s.byItem[0] ? s.byItem[0].name : "your biggest line"
      }. One item, one reason, one change.`
    );
  }

  return {
    id: "sc-habits",
    title: "The weekly habit that actually moves the number",
    body,
    bullets: [
      "Log waste as it happens, with a reason code and a cost, every shift.",
      "Count stock on the same day each week, before the order goes in.",
      "Total the waste weekly and express it against sales for the same week.",
      "Pick the single biggest reason code and change one thing about it.",
      "Check next week's log before deciding whether it worked.",
    ],
    keyPoint:
      "Cost control is not a spreadsheet. It is a habit that somebody keeps, in the room where the money is lost.",
  };
}

export function stockCostLessons(
  stock: CourseStock[],
  wastage: CourseWastage[],
  currency = "€"
): Lesson[] {
  const s = shape(stock, wastage);
  return [
    whyLesson(currency),
    listLesson(s, currency),
    reasonsLesson(),
    logLesson(s, currency),
    parLesson(s, currency),
    rotationLesson(s, currency),
    portionLesson(s, currency),
    habitsLesson(s, currency),
  ];
}

// --------------------------------------------------------------------------- //
// Knowledge questions — true for any venue
// --------------------------------------------------------------------------- //

function stockBank(sym: string): QuizQuestion[] {
  return [
    {
      id: "s-gp",
      kind: "single",
      prompt: "What does gross profit on a dish mean?",
      options: [
        "What the guest pays for it",
        "What the guest pays minus what the ingredients cost you",
        "What is left after wages and rent",
        "The margin the supplier makes",
      ],
      correct: [1],
      why: "Gross profit is sales minus cost of goods. Wages, rent and everything else come out of what is left.",
    },
    {
      id: "s-replace",
      kind: "single",
      prompt: `If food costs roughly 30 percent of what you charge, roughly how much extra in sales is needed to cover ${money(
        100,
        sym
      )} of stock thrown away?`,
      options: [
        `About ${money(100, sym)}`,
        `About ${money(130, sym)}`,
        `About ${money(333, sym)}`,
        "Nothing, waste is already priced into the menu",
      ],
      correct: [2],
      why: "Waste comes out of gross profit, so it takes several times its own value in sales to replace. That is why prevention beats selling more.",
    },
    {
      id: "s-costprice",
      kind: "single",
      prompt: "Should waste be costed at menu price or cost price?",
      options: [
        "Menu price, because that is the sale you lost",
        "Cost price, because that is what leaving stock actually cost you to buy",
        "Either, as long as you are consistent",
        "Neither — waste should be recorded as a quantity only",
      ],
      correct: [1],
      why: "Menu price inflates the figure and makes it easy to dismiss as unrealistic. Cost price is the money that actually left the business.",
    },
    {
      id: "s-portion-vs-pack",
      kind: "single",
      prompt: "A case of a product costs you a set amount. Why is that not the cost of one portion?",
      options: [
        "It is — divide by the number of items and you have it",
        "Because the pack has to be divided by the portions it actually yields, after trim, peel and cooking loss",
        "Because VAT has to be added first",
        "Because the price changes every week",
      ],
      correct: [1],
      why: "Yield is the difference between what you bought and what you can serve. Ignoring it understates every portion cost you calculate.",
    },
    {
      id: "s-reason-over",
      kind: "single",
      prompt: "Your waste log shows a large figure under over-prepped. What does that point at?",
      options: [
        "Storage temperatures",
        "Forecasting and prep quantities",
        "Supplier quality",
        "Portion sizes on the plate",
      ],
      correct: [1],
      why: "Over-production means more was prepped than was sold, which is a forecasting question, not a hygiene one.",
    },
    {
      id: "s-reason-spoil",
      kind: "single",
      prompt: "The same figure appears under spoiled instead. What does that point at?",
      options: [
        "Forecasting",
        "Storage, temperature, rotation or over-ordering",
        "The menu price",
        "The till system",
      ],
      correct: [1],
      why: "Same number, different problem. That is exactly why the reason column matters more than the total.",
    },
    {
      id: "s-reason-required",
      kind: "single",
      prompt: "Why must every waste line carry a reason code?",
      options: [
        "Because the law requires it",
        "Because without it you know only that you lost money, not which problem to fix",
        "So the manager knows who to blame",
        "For the supplier's records",
      ],
      correct: [1],
      why: "The total tells you there is a problem. The reason tells you what to change.",
    },
    {
      id: "s-blame",
      kind: "single",
      prompt: "What usually happens in a venue where staff feel they will be blamed for logging waste?",
      options: [
        "Waste goes down",
        "Waste stays the same but stops being recorded, so the venue loses the data it needs to fix it",
        "Staff log more of it to cover themselves",
        "Nothing changes",
      ],
      correct: [1],
      why: "An unrealistically clean waste log is a warning sign, not a good result. Make it easy and safe to log, and it gets logged.",
    },
    {
      id: "s-clean-log",
      kind: "single",
      prompt: "A busy kitchen's waste log has been empty for three weeks. What is the most likely explanation?",
      options: [
        "The kitchen has eliminated waste",
        "Waste is happening but nobody is recording it",
        "The log is broken",
        "The kitchen is not busy",
      ],
      correct: [1],
      why: "Every kitchen produces some waste. Zero recorded waste in a working kitchen means zero recording.",
    },
    {
      id: "s-par",
      kind: "single",
      prompt: "What is a reorder level for?",
      options: [
        "The maximum you are allowed to hold",
        "The point at which a line should go on the next order, so it does not run out before delivery",
        "The price you will not pay above",
        "The minimum order the supplier accepts",
      ],
      correct: [1],
      why: "Roughly what you use during the lead time, plus a small buffer. It replaces ordering by feel.",
    },
    {
      id: "s-overorder",
      kind: "single",
      prompt: "Why is over-ordering more expensive than it looks at the time?",
      options: [
        "Because suppliers charge more for large orders",
        "Because it looks like being well stocked, then reappears weeks later as out-of-date stock",
        "Because it uses up storage space",
        "It is not — extra stock is always safer",
      ],
      correct: [1],
      why: "Over-ordering never shows up in the log as over-ordering. It shows up as spoilage or expiry, long after the decision was made.",
    },
    {
      id: "s-count",
      kind: "single",
      prompt: "When should a stock count happen?",
      options: [
        "Whenever there is a quiet moment",
        "On the same day each week, before the order goes in",
        "Only at the end of the financial year",
        "After the delivery has been put away",
      ],
      correct: [1],
      why: "A count is only useful if it is regular and if it happens before the ordering decision it is meant to inform.",
    },
    {
      id: "s-fifo",
      kind: "single",
      prompt: "Why does putting a new delivery in front of existing stock cost money?",
      options: [
        "It does not, as long as everything is in date",
        "The older stock ends up at the back and reaches its date before it is used",
        "It damages the packaging",
        "It confuses the supplier's paperwork",
      ],
      correct: [1],
      why: "Nothing looks wrong on the day. The cost lands weeks later as expiry waste.",
    },
    {
      id: "s-label",
      kind: "single",
      prompt: "An undated prep container is a cost problem as well as a safety problem. Why?",
      options: [
        "It takes longer to find",
        "It gets thrown out early when it was fine, or used late when it was not — both cost you",
        "It cannot be counted",
        "It has to be re-weighed",
      ],
      correct: [1],
      why: "Undated stock forces a judgement call under pressure, and both possible errors are expensive.",
    },
    {
      id: "s-drift",
      kind: "single",
      prompt: "Why will a waste log never catch portion drift?",
      options: [
        "Because it is too small to matter",
        "Because the extra food is served and eaten, so it never goes in the bin",
        "Because portions are not costed",
        "It does catch it, under over-prep",
      ],
      correct: [1],
      why: "Drift leaves through the dining room, not the bin. Only a written spec and a scale will find it.",
    },
    {
      id: "s-spec",
      kind: "multi",
      prompt: "Which of these actually control portion cost? Choose all that apply.",
      options: [
        "A written portion size on the recipe",
        "Scales on the prep bench for the expensive components",
        "A photograph of the finished plate for reference",
        "Telling the team to be careful",
      ],
      correct: [0, 1, 2],
      why: "A spec, a measure and a reference are controls. A general appeal to be careful has never held for a full week anywhere.",
    },
    {
      id: "s-comp",
      kind: "single",
      prompt: "Where should comped dishes and staff food be recorded?",
      options: [
        "Under food waste with everything else",
        "Under their own codes, so they are still in the total but do not hide a kitchen problem",
        "Nowhere, they are not a cost",
        "Only if the manager approves them",
      ],
      correct: [1],
      why: "They are a real cost and belong in the total, but bundling them into food waste hides whether the problem is in the kitchen or in service.",
    },
    {
      id: "s-share",
      kind: "single",
      prompt: "Why express a weekly waste total as a percentage of sales rather than leaving it as a figure?",
      options: [
        "To make it look smaller",
        "Because a figure with no comparison is noise, and the share of sales shows whether a change worked",
        "Because accountants require it",
        "So it can be compared to other venues",
      ],
      correct: [1],
      why: "A busy week and a quiet week produce different totals. The share of sales is what makes the two comparable.",
    },
    {
      id: "s-concentration",
      kind: "single",
      prompt: "Waste in most venues is concentrated in a few expensive lines rather than spread evenly. Why is that good news?",
      options: [
        "It means the total is smaller than it looks",
        "It means one conversation about one item can move most of the number",
        "It means the supplier is at fault",
        "It means nothing needs to change",
      ],
      correct: [1],
      why: "Find the line carrying the biggest share and fix that. It beats a general campaign every time.",
    },
    {
      id: "s-stockout",
      kind: "single",
      prompt: "Running out of a line mid-service also has a cost. What is it?",
      options: [
        "None, as long as there is an alternative on the menu",
        "A lost sale, a slower table and a guest who got their second choice",
        "Only the delivery charge for an emergency order",
        "It saves money overall",
      ],
      correct: [1],
      why: "Both mistakes cost money, which is why the answer is a reorder level and a count rather than ordering plenty.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Venue questions — built from the venue's own stock list
// --------------------------------------------------------------------------- //

function stockQuestions(stock: CourseStock[], sym: string, seed: number): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  const s = shape(stock, []);

  if (stock.length === 0) {
    out.push({
      id: "sw-empty",
      kind: "single",
      prompt:
        "Your venue has no stock lines recorded yet. What is the first thing that becomes possible once the list exists and carries prices?",
      options: [
        "Nothing, it is only for ordering",
        "Waste can be costed, par levels can warn you before a line runs out, and a bad week can be told apart from a normal one",
        "The supplier can be changed",
        "Menu prices can be raised automatically",
      ],
      correct: [1],
      why: "A priced list is the foundation. Without it there is no cost price to value waste at and no level to order against.",
    });
    return out;
  }

  if (s.dearest && s.dearest.packPrice !== null) {
    out.push({
      id: `sw-dear-${s.dearest.id}`,
      kind: "single",
      prompt: `${s.dearest.name} is the most expensive pack on your own stock list at ${money(
        s.dearest.packPrice,
        sym
      )}. Why does that make it the first line to get right?`,
      options: [
        "It does not — every line matters exactly the same",
        "Because a small percentage error on an expensive line costs more than a large error on a cheap one, every week",
        "Because expensive stock spoils faster",
        "Because the supplier watches it",
      ],
      correct: [1],
      why: "Cost control is arithmetic, not fairness. Attention belongs where the money is.",
    });
  }

  if (s.divisible && s.divisible.packPrice !== null && s.divisible.packSize) {
    const unit = s.divisible.packUnit || s.divisible.unit;
    const per = s.divisible.packPrice / s.divisible.packSize;
    const wrong = per * 0.8;
    out.push({
      id: `sw-portion-${s.divisible.id}`,
      kind: "single",
      prompt: `On your list, ${s.divisible.name} costs ${money(
        s.divisible.packPrice,
        sym
      )} for ${s.divisible.packSize} ${unit}. About ${money(
        per,
        sym
      )} per ${unit} comes straight off that. Once trim and cooking loss are taken into account, what happens to the real cost per usable ${unit}?`,
      options: [
        `It stays at ${money(per, sym)}`,
        `It goes up, because you can serve less than you bought`,
        `It falls to about ${money(wrong, sym)}`,
        "It cannot be worked out",
      ],
      correct: [1],
      why: "Yield loss means fewer usable units out of the same pack, so the cost of each one you can actually serve rises.",
    });
  }

  if (s.atOrBelow.length > 0) {
    const item = s.atOrBelow[0];
    out.push({
      id: `sw-par-${item.id}`,
      kind: "single",
      prompt: `On your own stock list, ${item.name} is at or below its reorder level right now. What should that trigger?`,
      options: [
        "Nothing until it runs out completely",
        "It goes on the next order, at a sensible quantity, before a section runs dry mid-service",
        "An emergency order of as much as the supplier will send",
        "Removing the dish from the menu",
      ],
      correct: [1],
      why: "A reorder level is an early warning, not an alarm. It exists so ordering happens calmly and in the right quantity.",
    });
  } else if (s.withPar > 0) {
    out.push({
      id: `sw-nonebelow-${s.withPar}`,
      kind: "single",
      prompt: `${s.withPar} of your stock lines have a reorder level set and none of them is currently at or below it. What is worth checking?`,
      options: [
        "Nothing, that is a perfect result",
        "Whether the levels were set high enough to be useful and whether the counts are being kept up to date",
        "Whether the supplier has changed",
        "Whether the menu is too small",
      ],
      correct: [1],
      why: "A list where nothing ever reaches its reorder point is usually a list with levels set too low, or counts that are not current.",
    });
  }

  if (s.withPar === 0 && stock.length > 0) {
    out.push({
      id: `sw-nopar-${stock.length}`,
      kind: "single",
      prompt: `Your venue has ${stock.length} stock ${plural(
        stock.length,
        "line",
        "lines"
      )} and no reorder levels set on any of them. What does that mean in practice?`,
      options: [
        "Nothing, ordering works fine from experience",
        "Nothing can warn you before a line runs out, so every order relies on somebody remembering",
        "The stock list cannot be used at all",
        "Stock will automatically be over-ordered",
      ],
      correct: [1],
      why: "Roughly what you use during the lead time, plus a buffer, is all a reorder level needs to be. Without one the system cannot help.",
    });
  }

  if (s.unpriced > 0) {
    out.push({
      id: `sw-noprice-${s.unpriced}`,
      kind: "single",
      prompt: `${s.unpriced} of your ${stock.length} stock ${plural(
        stock.length,
        "line",
        "lines"
      )} ${plural(s.unpriced, "has", "have")} no price recorded. What is the consequence when one of those is wasted?`,
      options: [
        "It is costed at an average instead",
        "It cannot be costed at all, so it drops silently out of every waste total the venue looks at",
        "The waste line is rejected",
        "It is costed at menu price",
      ],
      correct: [1],
      why: "Never invent a figure, but do get the last invoice price on the line. Approximately right beats missing.",
    });
  } else {
    out.push({
      id: `sw-allpriced-${stock.length}`,
      kind: "single",
      prompt: `Every one of your ${stock.length} stock ${plural(
        stock.length,
        "line",
        "lines"
      )} carries a price. What still has to happen for those prices to stay useful?`,
      options: [
        "Nothing — once priced, always priced",
        "They have to be updated as invoices come in, because a stale price quietly misstates every portion cost and every waste total",
        "They should be rounded to the nearest euro",
        "They only matter at year end",
      ],
      correct: [1],
      why: "Supplier prices move. A cost figure from eighteen months ago will flatter or damn a dish for reasons that have nothing to do with the kitchen.",
    });
  }

  const heavyKeg = stock.find((i) => i.keg);
  if (heavyKeg) {
    out.push({
      id: `sw-keg-${heavyKeg.id}`,
      kind: "single",
      prompt: `Your stock list includes ${heavyKeg.name}. A keg holds a fixed number of servings. Where does the yield on it usually go missing?`,
      options: [
        "In the cellar temperature only",
        "In over-pours, unnecessary line flushes and pints poured away to clear a foamy line",
        "In the delivery",
        "Nowhere — keg yield is fixed",
      ],
      correct: [1],
      why: "The stock system says you have a keg. What you actually have is a keg minus whatever the bar has been giving away.",
    });
  }

  return shuffled(out, seed + 11);
}

/**
 * Build the paper. Venue questions from the stock list, then knowledge to a
 * floor of 8, topped up to 12 — same shape as every other course in the library.
 *
 * The waste log is deliberately not an input here. It feeds lessons only, so a
 * line logged or corrected mid-course cannot change the paper being graded.
 */
export function stockCostQuiz(
  stock: CourseStock[],
  seed: number,
  currency = "€"
): QuizQuestion[] {
  const mine = stockQuestions(stock, currency, seed);
  const wanted = 12;
  const knowledge = shuffled(stockBank(currency), seed).slice(
    0,
    Math.max(8, wanted - mine.length)
  );
  return shuffled([...mine, ...knowledge], seed + 41);
}
