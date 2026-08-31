/**
 * Deliveries & goods-in awareness — in-house course content.
 *
 * ── What this is ────────────────────────────────────────────────────────────
 * Employer-delivered awareness training on accepting deliveries: the cold
 * chain, arrival temperatures, when to reject a load, date codes, and the
 * traceability that a delivery record is supposed to leave behind. An operator
 * is generally expected to instruct staff in the food safety matters that apply
 * to their work and to be able to show where food came from. Neither of those
 * requires an awarding body.
 *
 * ── What it is NOT ──────────────────────────────────────────────────────────
 * It is NOT a HACCP Level 1 or 2, not a food safety certificate, and not a
 * substitute for the venue's own food safety management system. Arrival
 * temperature limits, tolerances and traceability duties differ by country and
 * sometimes by product; every figure below is given as a widely used one with a
 * nudge to check the local rule and the venue's own spec.
 *
 * ── Why goods-in is worth its own course ────────────────────────────────────
 * It is the only control point in the kitchen where the food is not yours yet.
 * A fridge that drifts can be corrected. A delivery accepted at the wrong
 * temperature, or accepted with nothing written down, cannot be — the evidence
 * leaves on the van. That makes goods-in the cheapest place in the building to
 * catch a problem and the most expensive place to wave one through.
 *
 * ── Which venue data it reads, and why that shape ────────────────────────────
 * HACCPRecord rows of checkType "delivery". Three different routes have written
 * that row over the life of the module — the manual form, an older form with a
 * packaging condition, and the delivery-note scanner — so kit.ts normalises all
 * three and leaves every field nullable. A missing temperature is never
 * defaulted to a number: "nobody recorded one" is the single sharpest lesson
 * this course has, and inventing a figure to fill the gap would destroy it.
 */

import {
  niceDate,
  type CourseDelivery,
  type Lesson,
  type QuizQuestion,
  shuffled,
} from "./kit";

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * Whole days between a record and the start of today.
 *
 * Measured from midnight rather than the exact clock so a lesson or a paper
 * rebuilt twenty minutes later at grading time reads the same number.
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

/** Newest first. Deterministic — never relies on the order rows arrived in. */
function byNewest(deliveries: CourseDelivery[]): CourseDelivery[] {
  return deliveries.slice().sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
}

/** The warmest logged arrival temperature, ignoring records with no temp. */
function warmest(deliveries: CourseDelivery[]): CourseDelivery | undefined {
  const withTemp = deliveries.filter((d) => d.temp !== null);
  if (withTemp.length === 0) return undefined;
  return withTemp.slice().sort((a, b) => {
    if (b.temp! !== a.temp!) return b.temp! - a.temp!;
    return b.checkedAt.localeCompare(a.checkedAt);
  })[0];
}

/** Newest record that was accepted with no temperature written down. */
function noTemp(deliveries: CourseDelivery[]): CourseDelivery | undefined {
  return byNewest(deliveries.filter((d) => d.temp === null))[0];
}

/**
 * Newest record that says who it came from and how warm it was, and nothing
 * else — no line items, no delivery note attached. It passes as a temperature
 * check and fails completely as a traceability record.
 */
function thinRecord(deliveries: CourseDelivery[]): CourseDelivery | undefined {
  return byNewest(
    deliveries.filter((d) => !d.hasInvoice && (d.itemCount === null || d.itemCount === 0))
  )[0];
}

function supplierName(d: CourseDelivery): string {
  return d.supplier ?? "an unnamed supplier";
}

function tempPhrase(d: CourseDelivery): string {
  return d.temp === null ? "no temperature recorded" : `${d.temp}°C`;
}

/** One line per delivery, for the venue lesson's bullet list. */
function deliveryLine(d: CourseDelivery): string {
  const bits: string[] = [];
  bits.push(tempPhrase(d));
  if (d.itemCount !== null && d.itemCount > 0) {
    bits.push(`${d.itemCount} ${plural(d.itemCount, "line", "lines")} listed`);
  } else {
    bits.push("no items listed");
  }
  if (d.hasInvoice) bits.push("delivery note attached");
  if (d.packagingCondition) bits.push(`packaging ${d.packagingCondition}`);
  return `${niceDate(d.checkedAt)} — ${supplierName(d)}: ${bits.join(", ")}, saved as "${d.status}"`;
}

// --------------------------------------------------------------------------- //
// The venue's own delivery records
// --------------------------------------------------------------------------- //

/**
 * Lesson one of the venue block: what the venue's own goods-in log shows.
 *
 * Three states, and the empty one is not treated as a failure — plenty of good
 * kitchens check every load and write none of it down. What the lesson says is
 * that an unwritten check cannot be shown to anybody afterwards.
 */
export function deliveriesLesson(deliveries: CourseDelivery[]): Lesson {
  if (deliveries.length === 0) {
    return {
      id: "your-deliveries",
      title: "Your own delivery records",
      body: [
        "This is normally the most useful lesson in the course, because it is the only part no outside training provider can give you: your own goods-in log, read back exactly as it was saved.",
        "Nothing has been logged here yet. Be straight about what that does and does not mean. It does not mean deliveries are being waved through — most kitchens check the chilled load with a probe or a hand on the box and think no more about it. It means none of those checks can be shown to anybody later.",
        "That matters in two specific moments. The first is a product recall: a supplier rings to say a batch is affected, and the question is whether it came here and where it went. The second is an inspection or a complaint, where the question is what arrived, at what temperature, and who accepted it. Both are answered from the goods-in record or not at all.",
        "Logging a delivery under HACCP takes well under a minute — supplier, temperature, condition, accepted or rejected. The delivery-note scan will fill most of it from a photo of the docket.",
      ],
      keyPoint:
        "An unrecorded delivery check is not a check anybody can rely on afterwards. The food is on the shelf either way; the difference is whether the venue can say where it came from.",
    };
  }

  const sorted = byNewest(deliveries);
  const newest = sorted[0];
  const oldest = sorted[sorted.length - 1];
  const missing = deliveries.filter((d) => d.temp === null).length;
  const withInvoice = deliveries.filter((d) => d.hasInvoice).length;
  const suppliers = Array.from(
    new Set(deliveries.map((d) => d.supplier).filter((s): s is string => Boolean(s)))
  );
  const w = warmest(deliveries);

  const body: string[] = [
    "This is the part no outside training provider can give you: your own goods-in log, read back exactly as it was saved.",
    `There ${plural(deliveries.length, "is", "are")} ${deliveries.length} delivery ${plural(
      deliveries.length,
      "check",
      "checks"
    )} recorded here, the most recent ${agoPhrase(newest.checkedAt)} from ${supplierName(
      newest
    )}. Read the list, then answer the questions at the end about it.`,
  ];

  if (missing > 0) {
    body.push(
      `${missing} of ${deliveries.length} ${plural(
        missing,
        "record has",
        "records have"
      )} no arrival temperature on ${plural(missing, "it", "them")} at all. That is the one worth stopping on. A goods-in record with no temperature says a delivery arrived and was accepted; it does not say the cold chain held. If the load was chilled or frozen and nobody wrote a number down, the check has not been evidenced — and the van has gone.`
    );
  } else {
    body.push(
      "Every record here has an arrival temperature on it, which is better than most kitchens manage. Keep it that way: the number is the only part of the check that cannot be reconstructed afterwards."
    );
  }

  if (w && w.temp !== null) {
    body.push(
      `The warmest arrival logged here is ${w.temp}°C, from ${supplierName(w)} on ${niceDate(
        w.checkedAt
      )}. Whether that figure is acceptable depends on what was in the load and on the limit your own food safety management system sets — chilled food is commonly expected at or below 5°C on arrival with a small tolerance, and frozen at or below -18°C. Check your own spec and the local rule rather than taking a number from a training page.`
    );
  }

  if (withInvoice === 0) {
    body.push(
      "No delivery note or invoice image is attached to any of these records. That is the traceability half of the job: the temperature says the food was safe on arrival, the docket says what the food actually was. Without it, a recall on one line of a mixed load cannot be traced from this record alone."
    );
  } else if (withInvoice < deliveries.length) {
    body.push(
      `${withInvoice} of ${deliveries.length} records have the delivery note attached. Those are the ones a recall can actually be traced through — the others say a delivery happened without saying what was in it.`
    );
  }

  if (suppliers.length > 0) {
    body.push(
      `The suppliers named in these records are ${suppliers
        .slice(0, 8)
        .join(", ")}${suppliers.length > 8 ? ", and others" : ""}. Knowing which of them regularly arrives warm, late or short is not gossip — it is the information that gets a supplier changed before it becomes a problem.`
    );
  }

  return {
    id: "your-deliveries",
    title: "Your own delivery records",
    body,
    bullets: sorted.slice(0, 12).map(deliveryLine),
    keyPoint:
      missing > 0
        ? "A delivery accepted with no temperature written down is the one check in the kitchen that can never be done again. Write the number at the door."
        : `Your oldest logged delivery is from ${niceDate(
            oldest.checkedAt
          )}. How far back the log goes is how far back a recall can be traced.`,
  };
}

/**
 * Lesson two of the venue block: the record as traceability rather than as a
 * temperature check. Reads the same rows from the other direction.
 */
export function traceabilityLesson(deliveries: CourseDelivery[]): Lesson {
  const withInvoice = deliveries.filter((d) => d.hasInvoice).length;
  const withItems = deliveries.filter((d) => d.itemCount !== null && d.itemCount > 0).length;
  const named = deliveries.filter((d) => d.supplier).length;

  const body: string[] = [
    "Traceability is the boring word for a simple question: if a supplier rings on Tuesday to say a batch of chicken from last week is being recalled, can this kitchen say whether it came here, and what happened to it?",
    "The rule most countries land on is one step back and one step forward — a food business should be able to say who supplied it and, if it sells on to other businesses, who it went to. For a restaurant serving the public, the practical version is the one-step-back half: the supplier, the date, and what was in the load. The exact duty and the retention period differ by country, so check your own local rule.",
  ];

  if (deliveries.length === 0) {
    body.push(
      "There are no delivery records here at all yet, so the answer to the recall question today would have to come from invoices in a folder, a supplier's own system, or somebody's memory. Those can work — but each of them is somebody else's record, not yours."
    );
  } else {
    body.push(
      `Of the ${deliveries.length} delivery ${plural(
        deliveries.length,
        "record",
        "records"
      )} here, ${named} ${plural(named, "names", "name")} the supplier, ${withItems} ${plural(
        withItems,
        "lists",
        "list"
      )} what actually came in, and ${withInvoice} ${plural(
        withInvoice,
        "has",
        "have"
      )} the delivery note attached as an image. A record that names the supplier and gives a temperature is a good hygiene check. A record that also lists the load, or carries the docket, is the one that answers a recall.`
    );
    body.push(
      "The other half is what happens after the box comes off the van. A batch code copied onto nothing, on a product that gets decanted into an unlabelled container, is untraceable an hour later even with a perfect goods-in record. Keep the original label, or move the code with the food."
    );
  }

  return {
    id: "traceability",
    title: "Where the food came from",
    body,
    bullets: [
      "Supplier, date and what arrived — the minimum that answers a recall",
      "The docket photographed onto the record beats the docket in a drawer",
      "Batch and lot codes matter most on meat, dairy, eggs and ready-to-eat items",
      "Decanting into an unlabelled tub destroys traceability instantly",
      "A supplier's own paperwork is evidence about them, not about you",
    ],
    keyPoint:
      "The recall question is never asked in advance. Whatever gets written at the door on a Tuesday morning is the whole answer three weeks later.",
  };
}

// --------------------------------------------------------------------------- //
// Lessons
// --------------------------------------------------------------------------- //

export function deliveriesLessons(deliveries: CourseDelivery[]): Lesson[] {
  const knowledge: Lesson[] = [
    {
      id: "why",
      title: "Why the door is the important bit",
      body: [
        "Almost everything else in a kitchen can be fixed after the fact. A fridge running warm gets corrected and the food gets moved. A dish cooked light goes back on the heat. Goods-in is the exception: once the van has left, whatever came off it is yours, at whatever temperature it arrived, with whatever damage it already had.",
        "That is why the check happens at the door and not later. Ten minutes after the driver leaves, a chilled load that arrived at 12°C looks exactly like one that arrived at 3°C — it feels cold, it goes in the fridge, and by service nobody can tell the difference. The bacteria can. Time spent warm is cumulative and it does not reset when the food goes back into the cold.",
        "There is a second reason, and it is the one that bites commercially. A delivery is also a financial document: quantities, prices, substitutions, short items, credits. The person checking the temperature is usually the only person who will ever see the food and the docket in the same room.",
      ],
      keyPoint:
        "Goods-in is the only control point where the food is not yours yet. It is the cheapest place in the building to catch a problem and the most expensive place to wave one through.",
    },
    {
      id: "cold-chain",
      title: "The cold chain, and why it does not reset",
      body: [
        "Chilled food is safe because it has been kept cold continuously, from the producer to the plate. Every warm gap in that chain — the loading bay, the van in traffic, the pallet standing in the yard, the box on the kitchen floor while the paperwork is checked — adds up. Bacteria do not undo their growth when the food goes back into the fridge; the count stays where it got to and carries on from there next time.",
        "This is why a delivery standing in the corridor for twenty minutes is not a small thing, and why the order of the job matters: chilled and frozen off the van and into the cold first, paperwork second. Ambient goods can wait on the floor all morning. A crate of chicken cannot.",
        "A widely used working rule is to get chilled and frozen goods into storage inside about twenty minutes of arrival, and to check the temperature of the load before that happens rather than after. Treat the figure as a target to check against your own food safety management system, not as a law.",
      ],
      bullets: [
        "Chilled and frozen off the van first, docket checked second",
        "Never stack a chilled delivery in a warm corridor or in direct sun",
        "Time spent warm accumulates across the whole life of the food",
        "Frozen food that has thawed must never be refrozen",
        "A cold box on the outside can still be warm in the middle",
      ],
      keyPoint:
        "There is no such thing as putting the cold back. The only question at the door is how much warm time the food has already had.",
    },
    {
      id: "temperatures",
      title: "Numbers at the door",
      body: [
        "The figures that follow are the ones most commonly used in commercial kitchens, and they are a starting point for checking your own rules rather than the rule itself. Limits, tolerances and how they are enforced differ by country, and your own food safety management system or supplier spec may be tighter.",
        "Chilled food is commonly expected to arrive at or below 5°C, with some regimes working to 8°C as the legal ceiling and good practice sitting nearer 0–5°C. Frozen food is commonly expected at or below -18°C, with a small tolerance for transport — often quoted as up to -15°C on arrival — and any sign of thawing treated as a rejection regardless of the number. Hot food in transit, which is rare for a delivery, is usually held at or above 63°C. Ambient goods have no temperature, so the check on them is date, damage and pests.",
        "The number matters less than what you do with it. A reading outside the limit is not automatically a rejection — it is a decision, and the decision needs a person with the authority to make it and a note explaining what was decided. What is never acceptable is reading the number, not liking it, and putting the food away anyway without writing anything down.",
      ],
      bullets: [
        "Chilled: commonly at or below 5°C on arrival — check your own limit",
        "Frozen: commonly at or below -18°C, small transport tolerance, no thawing",
        "Hot in transit: commonly at or above 63°C",
        "Ambient: no temperature — check dates, damage and pests instead",
        "Every figure here is a common practice figure, not a substitute for local law",
      ],
      keyPoint:
        "Reading a bad number and saying nothing is worse than not reading it, because now the venue's own record shows it knew.",
    },
    {
      id: "how-to-check",
      title: "Taking the temperature properly",
      body: [
        "An infrared thermometer reads the surface of whatever it is pointed at. That makes it fast and non-destructive, and it makes it easy to fool: a box straight out of the sun reads warm, a shiny wrapper reads cold, and the surface of a frozen block that has been in a chilled van reads colder than the middle. Use it for a first look across a load.",
        "A probe reads the actual food temperature and is what a disputed reading needs. Piercing a sealed pack destroys the pack, so the usual approach for sealed goods is the between-packs method: slide the probe between two packs in the middle of the load, press them together, and wait for the reading to settle. If a genuine core reading is needed, probe a pack you are prepared to open and use or reject.",
        "Whichever tool is used, it is worth nothing if it is wrong. Probes get checked against ice water at 0°C and, where the venue does it, boiling water at 100°C adjusted for altitude, and they get sanitised between foods — a probe that has been in raw chicken and then goes into a tub of cream has just done more harm than the check prevented.",
      ],
      bullets: [
        "Infrared for a fast scan of the load — it reads surfaces, not food",
        "Probe between two packs in the middle of the load for sealed goods",
        "Sanitise the probe between every food, especially after raw meat",
        "Check the probe against ice water regularly and log that you did",
        "Take the reading before the load goes into storage, not after",
      ],
      keyPoint:
        "An unchecked probe and a sunny box will between them let you sign off a warm delivery with a perfect number on the record.",
    },
    {
      id: "rejecting",
      title: "Rejecting a load, and the awkward bit",
      body: [
        "Rejection is the whole reason the check exists, and it is the part people avoid. The driver is in a hurry, the kitchen needs the chicken for tonight, the head chef is not in, and sending it back means an argument and a gap on the menu. Every one of those pressures is real and none of them changes what the food is.",
        "The things that get a load rejected are mostly visible before any thermometer comes out. Frozen packs with ice crystals inside the bag, or frozen solid into a single block, have thawed and been refrozen. Swollen, badly dented or rusted cans — particularly dents on a seam — can have lost their seal. Torn or wet packaging on ready-to-eat food, raw meat juice running onto other products in the same crate, live pests or gnaw marks on outer cardboard, a use-by date already passed or too close to be usable, and a vehicle that is not refrigerated when it should be: all of those are reasons to refuse before anybody argues about degrees.",
        "The mechanics matter. Refuse the item rather than the whole load if the rest is sound, write down what was refused and why, get the driver to acknowledge it on the docket, and tell whoever orders from that supplier the same day. A rejection that nobody records becomes a credit that never arrives and a supplier who never learns.",
      ],
      bullets: [
        "Ice crystals inside frozen packaging mean thawed and refrozen — refuse",
        "Swollen or seam-dented cans — refuse, do not open to check",
        "Raw meat juices over other products in the crate — refuse the affected items",
        "Use-by already passed, or too short to be usable — refuse",
        "Live pests, droppings or gnaw marks on outer packaging — refuse",
        "Write down what was refused and why, and have the driver acknowledge it",
      ],
      keyPoint:
        "Nobody has ever been disciplined for refusing a load that turned out to be fine. The other way round has closed kitchens.",
    },
    {
      id: "dates-and-rotation",
      title: "Dates, codes and what happens next",
      body: [
        "Two kinds of date arrive on a delivery and they mean different things. A use-by date is a safety date on highly perishable food, and food past it should not be used or sold even if it looks and smells fine. A best-before date is a quality date: the food is not automatically unsafe afterwards, though selling or serving it may still be restricted and it may simply not be good enough to put in front of a guest. Some countries add their own labelling rules on top, so check the local position.",
        "Short-dated stock is the quiet problem at goods-in. A delivery of yoghurt with two days left is technically in date and practically useless, and accepting it moves the supplier's waste problem into your fridge. It is a legitimate reason to refuse an item, and it needs the same note as any other rejection.",
        "Once accepted, the food joins the rotation. Stock rotation — first in, first out, or first to expire, first out where the dates are not in delivery order — is what stops the new box being stacked in front of the old one until the old one goes out of date at the back of the shelf. That is also where the traceability chain usually breaks: a product decanted into an unlabelled container has lost its date and its batch code in one move.",
      ],
      bullets: [
        "Use-by is a safety date — do not use food past it",
        "Best-before is a quality date, with its own local rules on sale",
        "Short-dated deliveries can be refused; note it like any rejection",
        "Rotate so the oldest date is at the front, not the newest",
        "Decanting without moving the label destroys the date and the code",
      ],
      keyPoint:
        "The date on the box only protects anybody if it survives the journey to the shelf and stays with the food after it is opened.",
    },
    {
      id: "allergens-at-the-door",
      title: "The delivery that changes what is in your food",
      body: [
        "The most under-appreciated risk at goods-in is not temperature. It is substitution. A supplier is out of the usual mayonnaise and sends a different brand, the same product changes recipe, or a line arrives from a different manufacturer with a different allergen profile and a different 'may contain' statement. Nothing on the shelf looks different. The dish on the menu now contains something it did not contain last week.",
        "This is the point where goods-in meets the allergen matrix. A substituted item needs the label read, and if the allergens have changed, the dishes it goes into need updating — not next month, before service. The same applies to a product whose 'may contain' warning has appeared or disappeared: that is exactly the information a guest with an allergy is relying on.",
        "The practical habit is small: when something arrives that is not what was ordered, read the allergen line on the label before it goes into storage, and tell whoever maintains the dish information if it differs. It takes seconds at the door and is close to impossible to reconstruct afterwards.",
      ],
      bullets: [
        "A substitution can change the allergens in a dish with no visible change",
        "Read the allergen line on any product that is not the usual one",
        "Tell whoever maintains dish allergen information the same day",
        "Recipe changes on a familiar product happen without warning",
        "'May contain' statements change too, and guests rely on them",
      ],
      keyPoint:
        "The allergen information on your menu is only as current as the last delivery nobody checked the label on.",
    },
    {
      id: "the-record",
      title: "What the record has to say",
      body: [
        "A useful goods-in record answers five questions without anybody having to remember anything: who it came from, when it arrived, what was in it, what condition and temperature it was in, and who accepted or refused it. Anything beyond that is a bonus; anything less leaves a gap that only memory can fill, and memory does not survive a busy month.",
        "The most common failure is not a missing record — it is a record that says a delivery happened and nothing more. Supplier and a tick. That satisfies the habit of logging and answers none of the five questions. The second most common is a temperature recorded on a load where the temperature was never actually taken, which is worse than a blank, because a false number is evidence pointing the wrong way.",
        "Where a delivery note is photographed onto the record, most of the work is done automatically: the items, the quantities and the date come off the docket. What still has to come from the person at the door is the temperature, the condition, and the decision.",
      ],
      bullets: [
        "Supplier, date, items, temperature, condition, who accepted it",
        "A tick with no temperature is a habit, not a check",
        "A number nobody measured is worse than a blank",
        "Photograph the docket — it carries the items and the date for you",
        "Record refusals as carefully as acceptances, or the credit never comes",
      ],
      keyPoint:
        "Write the record for the person who reads it in six months knowing nothing about that morning. That person is usually you.",
    },
  ];

  // The venue's own log goes last, after the general lessons, so the trainee
  // reads the principle before seeing how their own door measures against it.
  return [...knowledge, deliveriesLesson(deliveries), traceabilityLesson(deliveries)];
}

// --------------------------------------------------------------------------- //
// Knowledge bank
// --------------------------------------------------------------------------- //

export function deliveriesBank(): QuizQuestion[] {
  return [
    {
      id: "d-why-door",
      kind: "single",
      prompt:
        "Why is the delivery check done at the door rather than after the food is put away?",
      options: [
        "Because the driver has to countersign it",
        "Because once the van has gone, a load that arrived warm is indistinguishable from one that arrived cold",
        "Because the fridge would warm the food up",
        "Because it is quicker",
      ],
      correct: [1],
      why: "Ten minutes later a warm load feels cold and goes away unnoticed. The evidence leaves with the van.",
    },
    {
      id: "d-cumulative",
      kind: "single",
      prompt: "A chilled delivery stood in a warm corridor for 25 minutes and is now in the fridge. What is the position?",
      options: [
        "It is fine — it is back below 5°C now",
        "The warm time still counts; bacterial growth does not undo itself when food is re-chilled",
        "It is fine as long as it is used today",
        "It only matters if the food is raw",
      ],
      correct: [1],
      why: "Time spent warm accumulates across the whole life of the food. Chilling stops growth; it does not reverse it.",
    },
    {
      id: "d-order",
      kind: "single",
      prompt: "A mixed delivery arrives: frozen, chilled and ambient, plus a docket to check. What order?",
      options: [
        "Docket first, so nothing is signed for wrongly",
        "Ambient away first because it is heaviest",
        "Temperature-check and put away frozen and chilled first, then deal with the docket and the ambient goods",
        "Whatever order the driver prefers",
      ],
      correct: [2],
      why: "Ambient goods can wait on the floor all morning. Chilled and frozen cannot.",
    },
    {
      id: "d-chilled-target",
      kind: "single",
      prompt: "What is the commonly used expectation for chilled food arriving at a commercial kitchen?",
      options: [
        "At or below 5°C, subject to your own limit and local law",
        "At or below 15°C",
        "Room temperature is acceptable if it is used the same day",
        "There is no expectation for deliveries",
      ],
      correct: [0],
      why: "Commonly at or below 5°C, with some regimes working to an 8°C ceiling. Always check your own spec and local rule.",
    },
    {
      id: "d-frozen-target",
      kind: "single",
      prompt: "Frozen goods arrive. Which of these is the commonly used expectation?",
      options: [
        "At or below 0°C",
        "At or below -18°C, with a small transport tolerance and no sign of thawing",
        "Anything solid is acceptable",
        "At or below -40°C",
      ],
      correct: [1],
      why: "-18°C or below is the usual figure, often with tolerance to around -15°C on arrival. Signs of thawing outrank the number.",
    },
    {
      id: "d-icecrystals",
      kind: "single",
      prompt: "A bag of frozen prawns has large ice crystals inside the packaging and has set into a solid block. What does that indicate?",
      options: [
        "It has been frozen especially hard — a good sign",
        "It has thawed and been refrozen at some point, and should be refused",
        "Nothing — ice crystals are normal",
        "It needs to be used within 24 hours",
      ],
      correct: [1],
      why: "Ice crystals inside the bag and blocking together are the classic evidence of a thaw-refreeze cycle. Refuse it.",
    },
    {
      id: "d-cans",
      kind: "single",
      prompt: "Which of these tinned goods should be refused at the door?",
      options: [
        "A can with a scuff on the label",
        "A can with a swollen end, or a sharp dent on a seam",
        "A can with a best-before date six months away",
        "A can that feels heavier than the others",
      ],
      correct: [1],
      why: "Swelling suggests gas from spoilage; a seam dent can breach the seal. Do not open it to check — refuse it.",
    },
    {
      id: "d-infrared",
      kind: "single",
      prompt: "What does an infrared thermometer actually measure on a delivery?",
      options: [
        "The core temperature of the food",
        "The surface temperature of whatever it is pointed at",
        "The average temperature of the van",
        "The temperature the food was packed at",
      ],
      correct: [1],
      why: "Surface only. Useful for scanning a load fast, easy to fool with sun, shiny wrapping or a cold outer layer.",
    },
    {
      id: "d-betweenpacks",
      kind: "single",
      prompt: "You need a reliable temperature from sealed chilled packs without destroying stock. What is the usual method?",
      options: [
        "Pierce the top pack with a probe",
        "Probe between two packs in the middle of the load, pressed together, and let the reading settle",
        "Read the outside of the box with your hand",
        "Take the van's own display reading",
      ],
      correct: [1],
      why: "The between-packs method gets close to food temperature without breaching a pack.",
    },
    {
      id: "d-probe-hygiene",
      kind: "single",
      prompt: "A probe has just been used in raw chicken. The next thing to check is a tub of cream. What has to happen first?",
      options: [
        "Nothing, the probe is only in contact briefly",
        "Wipe it on a cloth",
        "Clean and sanitise the probe before it touches the cream",
        "Use the other end of the probe",
      ],
      correct: [2],
      why: "An unsanitised probe moves bacteria from raw food into ready-to-eat food — doing more harm than the check prevents.",
    },
    {
      id: "d-probe-calibration",
      kind: "single",
      prompt: "Why does a probe get checked against ice water?",
      options: [
        "To cool it down before use",
        "To confirm it reads accurately, because a drifting probe produces confident wrong numbers",
        "To clean it",
        "It does not — probes never drift",
      ],
      correct: [1],
      why: "Ice water sits at about 0°C. A probe that reads 3°C in it has been signing off warm deliveries as cold.",
    },
    {
      id: "d-bad-number",
      kind: "single",
      prompt: "A chilled load reads 9°C against a venue limit of 5°C. The chef is out and tonight's menu needs it. What is the right action?",
      options: [
        "Put it away and mention it tomorrow",
        "Put it away and record 5°C so the log looks right",
        "Hold the item, get the decision from someone with authority, and record the reading and the decision either way",
        "Refuse the entire delivery including the ambient goods",
      ],
      correct: [2],
      why: "A reading outside the limit is a decision, not automatically a rejection. What is never acceptable is an unrecorded one.",
    },
    {
      id: "d-false-number",
      kind: "single",
      prompt: "Which is worse on a goods-in record: a blank temperature field, or a temperature nobody actually measured?",
      options: [
        "The blank — an incomplete record is the bigger failing",
        "The invented number — it is evidence that actively points the wrong way",
        "They are equivalent",
        "Neither matters if the food was fine",
      ],
      correct: [1],
      why: "A blank shows a gap. A false figure shows a check that was never done, and it will be relied on by somebody later.",
    },
    {
      id: "d-raw-juice",
      kind: "single",
      prompt: "A crate arrives with raw chicken packs leaking over bagged salad in the same crate. What happens?",
      options: [
        "Wash the salad and use it",
        "Accept both — the packaging protected the salad",
        "Refuse the affected ready-to-eat items and record why",
        "Accept it but use the salad first",
      ],
      correct: [2],
      why: "Cross-contamination of ready-to-eat food cannot be washed out. Refuse the affected items and note it on the record.",
    },
    {
      id: "d-useby",
      kind: "single",
      prompt: "What does a use-by date mean, as against a best-before date?",
      options: [
        "They mean the same thing",
        "Use-by is a safety date on perishable food; best-before is a quality date",
        "Best-before is the safety date",
        "Use-by only applies to frozen food",
      ],
      correct: [1],
      why: "Food past its use-by should not be used or sold even if it looks fine. Best-before is about quality, with its own local rules.",
    },
    {
      id: "d-shortdated",
      kind: "single",
      prompt: "A delivery of yoghurt arrives in date, but with two days left on it. Is that a problem?",
      options: [
        "No — in date is in date",
        "Yes, it is a legitimate reason to refuse the item, and the refusal should be recorded",
        "Yes, but nothing can be done about it",
        "Only if it was ordered on a special",
      ],
      correct: [1],
      why: "Accepting short-dated stock moves the supplier's waste problem into your fridge. Refuse it and record it like any rejection.",
    },
    {
      id: "d-rotation",
      kind: "single",
      prompt: "The new delivery is stacked in front of the existing stock on the shelf. What is wrong with that?",
      options: [
        "Nothing, as long as everything is in date",
        "The older stock ends up at the back and goes out of date unused — rotate so the oldest is used first",
        "It makes the shelf look untidy",
        "Nothing, provided the newest is used first",
      ],
      correct: [1],
      why: "First in, first out — or first to expire, first out where the dates do not arrive in order.",
    },
    {
      id: "d-decant",
      kind: "single",
      prompt: "A sauce is decanted from its original container into an unlabelled tub. What has just been lost?",
      options: [
        "Nothing — it is the same sauce",
        "The date, the batch code and the allergen information, so the product is untraceable and unidentifiable",
        "Only the brand name",
        "Only the price",
      ],
      correct: [1],
      why: "This is where the traceability chain usually breaks, an hour after a perfect goods-in record was written.",
    },
    {
      id: "d-substitution",
      kind: "single",
      prompt: "A supplier substitutes a different brand of the same product. What is the food safety implication?",
      options: [
        "None, it is the same product",
        "The allergen profile may have changed, so the label needs reading and dish information may need updating",
        "It only affects the price",
        "It only matters for frozen goods",
      ],
      correct: [1],
      why: "A substitution can change what is in a dish with nothing visible changing. This is the link between goods-in and the allergen matrix.",
    },
    {
      id: "d-traceability",
      kind: "single",
      prompt: "A supplier issues a recall on a batch delivered last week. What does the venue need to be able to say?",
      options: [
        "Only whether anybody has complained",
        "Whether that product came here, when, and what happened to it",
        "Nothing — the recall is the supplier's problem",
        "Only the price paid",
      ],
      correct: [1],
      why: "One step back is the practical duty for a venue serving the public: who supplied it, when, and what it was.",
    },
    {
      id: "d-docket",
      kind: "single",
      prompt: "Why is photographing the delivery note onto the record worth the two seconds?",
      options: [
        "It proves the driver attended",
        "It carries the items, quantities and date onto the record, which is what a recall is actually traced through",
        "It replaces the temperature check",
        "It is required by law everywhere",
      ],
      correct: [1],
      why: "The temperature says the food was safe. The docket says what the food was. A recall needs the second one.",
    },
    {
      id: "d-pests",
      kind: "single",
      prompt: "Outer cardboard on a delivery has gnaw marks and droppings on it. What is the correct response?",
      options: [
        "Wipe it and bring it into the dry store",
        "Refuse the affected goods, record it, and do not bring that packaging into storage",
        "Accept it but store it separately",
        "Nothing — outer packaging is always dirty",
      ],
      correct: [1],
      why: "Signs of pest activity on packaging are a rejection, and outer cardboard is a common way an infestation arrives.",
    },
    {
      id: "d-vehicle",
      kind: "single",
      prompt: "Chilled goods arrive in a van with no refrigeration running on a warm day. The packs read 6°C. What is the concern?",
      options: [
        "None — the reading is close enough",
        "The reading is a surface snapshot of a load with no temperature control, so the real question is how long it has been like that",
        "Only the driver's paperwork",
        "Nothing, if the food is cooked before serving",
      ],
      correct: [1],
      why: "An uncontrolled vehicle makes any single reading unreliable and the warm time unknown. Escalate rather than absorb it.",
    },
    {
      id: "d-refuse-culture",
      kind: "single",
      prompt: "Which pressure is a legitimate reason to accept a load you would otherwise refuse?",
      options: [
        "The menu needs it tonight",
        "The driver is in a hurry",
        "The manager is not in to ask",
        "None of them — those are all reasons to escalate, not to accept",
      ],
      correct: [3],
      why: "Every one of those pressures is real. None of them changes what the food is.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Venue questions
// --------------------------------------------------------------------------- //

/**
 * Questions built from the venue's own goods-in log.
 *
 * Every one of these is rebuildable from the ticket's record ids at grading
 * time, which is why nothing here reads a supplier's stock list or anything
 * else that is not carried on the ticket.
 */
export function deliveryQuestions(
  deliveries: CourseDelivery[],
  seed: number
): QuizQuestion[] {
  if (deliveries.length === 0) {
    return [
      {
        id: "d-empty",
        kind: "single",
        prompt:
          "No delivery checks have ever been logged at this venue. What does that empty record actually prove?",
        options: [
          "That deliveries are being waved through unchecked",
          "Nothing about whether loads are checked — but it means no check can be shown afterwards, and a recall cannot be traced from your own records",
          "Nothing at all, so it does not matter",
          "That this venue does not need to check deliveries",
        ],
        correct: [1],
        why: "Most kitchens do check the chilled load. The gap is evidence, not care — and a recall is answered from the record or not at all.",
      },
      {
        id: "d-empty-why",
        kind: "single",
        prompt:
          "Deliveries here get checked but not logged. Which specific moment does the missing log cost you?",
        options: [
          "The moment an inspector asks to see a certificate",
          "A supplier recall, when the question is whether that batch came here and where it went",
          "The moment a guest complains about a dish",
          "It costs nothing if the checks are being done",
        ],
        correct: [1],
        why: "A recall is the moment the goods-in record earns its keep. Nothing else in the building answers that question.",
      },
    ];
  }

  const out: QuizQuestion[] = [];
  const sorted = byNewest(deliveries);
  const newest = sorted[0];

  // 1. Accepted with no temperature at all. The sharpest question available.
  const blank = noTemp(deliveries);
  if (blank) {
    const missing = deliveries.filter((d) => d.temp === null).length;
    out.push({
      id: `d-notemp-${blank.id}`,
      kind: "single",
      prompt: `${missing} of your ${deliveries.length} logged deliveries have no arrival temperature on them at all — the most recent from ${supplierName(
        blank
      )} on ${niceDate(
        blank.checkedAt
      )}. What does a delivery record with no temperature tell somebody reading it back?`,
      options: [
        "That the delivery was checked and passed",
        "That a delivery arrived and was accepted — but not that the cold chain held, and that can never be checked again",
        "That the load was ambient goods, so no temperature was needed",
        "Nothing at all, so it makes no difference",
      ],
      correct: [1],
      why: "The van has gone. A missing arrival temperature is the one check in the kitchen that genuinely cannot be repeated.",
    });
  }

  // 2. The warmest thing they actually logged, asked as a judgement question
  //    rather than a pass/fail — the venue's own limit is what decides it.
  const w = warmest(deliveries);
  if (w && w.temp !== null) {
    out.push({
      id: `d-warmest-${w.id}`,
      kind: "single",
      prompt: `The warmest arrival temperature in your own log is ${w.temp}°C, from ${supplierName(
        w
      )} on ${niceDate(w.checkedAt)}. How should a reading like that be handled at the door?`,
      options: [
        "Compare it against the limit in your own food safety management system and record the reading and the decision either way",
        "Accept it — anything under 10°C is safe",
        "Refuse the whole delivery automatically",
        "Put it away and mention it if anybody asks",
      ],
      correct: [0],
      why: "The venue's own limit decides it, not a figure from a training page. What is never acceptable is an unrecorded decision.",
    });
  }

  // 3. The record that names a supplier and a temperature and nothing else.
  const thin = thinRecord(deliveries);
  if (thin) {
    out.push({
      id: `d-thin-${thin.id}`,
      kind: "single",
      prompt: `Your ${supplierName(thin)} delivery on ${niceDate(
        thin.checkedAt
      )} is logged with ${tempPhrase(
        thin
      )}, no list of what came in, and no delivery note attached. What can that record not do?`,
      options: [
        "It cannot show the delivery happened",
        "It cannot answer a recall, because it does not say what was actually in the load",
        "It cannot prove who accepted the load",
        "Nothing — it is a complete record",
      ],
      correct: [1],
      why: "Supplier and temperature is a hygiene check. Traceability needs what was in the load — that is what the docket photo carries.",
    });
  }

  // 4. Nothing logged for a long time. Only fires when the gap is real.
  const gap = daysAgo(newest.checkedAt);
  if (gap >= 21) {
    out.push({
      id: `d-stale-${newest.id}`,
      kind: "single",
      prompt: `The most recent delivery logged here was ${agoPhrase(
        newest.checkedAt
      )}, from ${supplierName(
        newest
      )}. Deliveries have almost certainly arrived since. What is the honest reading of that gap?`,
      options: [
        "The log is up to date because nothing needed recording",
        "Goods-in checks have stopped being recorded, so recent deliveries cannot be traced from your own records",
        "It proves the recent deliveries were unchecked",
        "It does not matter as long as the food was fine",
      ],
      correct: [1],
      why: "A log that stops is worse than no log, because it looks complete. The gap is exactly where a recall would land.",
    });
  }

  // Deterministic order, then let the caller shuffle the whole paper.
  return shuffled(out, seed + 7);
}

/**
 * Build the paper. Venue questions first, then knowledge questions to a floor
 * of 8, topped up towards 12 — the same degradation rule as the other courses,
 * so a venue with one delivery record still sits a full paper.
 */
export function deliveriesQuiz(deliveries: CourseDelivery[], seed: number): QuizQuestion[] {
  const venue = deliveryQuestions(deliveries, seed);
  const wanted = 12;
  const knowledge = shuffled(deliveriesBank(), seed).slice(
    0,
    Math.max(8, wanted - venue.length)
  );
  return shuffled([...venue, ...knowledge], seed + 31);
}
