/**
 * Food hygiene awareness — in-house course content.
 *
 * ── What this is ────────────────────────────────────────────────────────────
 * Employer-delivered food hygiene AWARENESS, built around the venue's own HACCP
 * units and its own check schedule. An operator is generally expected to make
 * sure food handlers are instructed and supervised in food hygiene matters
 * appropriate to their work, and nothing about that requires an awarding body.
 *
 * ── What it is NOT ──────────────────────────────────────────────────────────
 * It is NOT HACCP Level 1 or Level 2. It is NOT a food safety certificate, a
 * food handler's licence, or a Safe Catering / accredited HACCP qualification.
 * Those come from an accredited provider, and in several countries an operator
 * is specifically expected to hold one for whoever manages the food safety
 * system. Nothing in this course may imply otherwise, which is why the record
 * it writes is filed as OTHER and titled "(in-house)".
 *
 * The numbers here are the widely used ones and they are hedged accordingly.
 * Fridge maximums, hot-holding minimums, core cooking temperatures and cooling
 * schedules all differ between countries, and the figures the course teaches are
 * the ones the venue's own HACCP module marks against — see HACCP_TARGETS in
 * kit.ts. Check local rules rather than trusting any training material,
 * including this one.
 */

import {
  HACCP_TARGETS,
  type CourseHaccpCheck,
  type CourseHaccpUnit,
  type Lesson,
  type QuizQuestion,
  shuffled,
} from "./kit";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

// --------------------------------------------------------------------------- //
// The venue's own units
// --------------------------------------------------------------------------- //

/**
 * The lesson built from the venue's own HACCP equipment list.
 *
 * Three states, because a half-built list is a different lesson from an empty
 * one and both are common. Nothing is ever invented: if a unit type carries no
 * target range in the module, the lesson says so.
 */
export function unitLesson(units: CourseHaccpUnit[]): Lesson {
  if (units.length === 0) {
    return {
      id: "your-units",
      title: "Your own units",
      body: [
        "This is normally the most useful lesson in the course, because it is the only part no outside training provider can give you: your own fridges, freezers and hot-holding units, by name, with the range each one is supposed to hold.",
        "Nobody has added any named units to your HACCP equipment list yet, so there is nothing to show here. A manager can add them under HACCP, and the temperature checks then hang off a named unit instead of a generic one.",
        "That naming is not admin for its own sake. A log that says \"fridge: 3°C\" proves almost nothing in a venue with five fridges — it cannot show which unit was checked, and it cannot show that the one that failed last month is being watched. A log against \"Prep Fridge\" can do both.",
      ],
      keyPoint:
        "Until units are named, a temperature log cannot show which unit was checked or which one was missed. Check every unit you have anyway, and ask a manager to get them on the list.",
    };
  }

  const byType = new Map<string, CourseHaccpUnit[]>();
  for (const u of units) {
    const list = byType.get(u.type) ?? [];
    list.push(u);
    byType.set(u.type, list);
  }

  const bullets = units.map((u) => `${u.name} — ${u.typeLabel}, target ${u.target}`);

  const typeSummary = [...byType.entries()]
    .map(([type, list]) => {
      const label = HACCP_TARGETS[type]?.label ?? "other";
      return `${list.length} ${label.toLowerCase()}${list.length === 1 ? "" : " units"}`;
    })
    .join(", ");

  const body = [
    "This is the part no outside training provider can give you: the units on your own HACCP list, by name, with the range each one is supposed to hold.",
    `You have ${units.length} named ${plural(units.length, "unit", "units")} — ${typeSummary}. Read the list, then answer the questions at the end about them. You are not expected to memorise every number; you are expected to know that a hot-holding unit and a fridge are held to opposite ends of the same scale, and to know where to look mid-service.`,
  ];

  const missingTargets = units.filter((u) => u.min === null && u.max === null);
  if (missingTargets.length > 0) {
    body.push(
      `${missingTargets.length} of them ${plural(missingTargets.length, "is", "are")} recorded under a type with no target range set, so the check cannot pass or fail automatically. Ask a manager which range applies before you sign anything off against ${plural(missingTargets.length, "it", "them")}.`
    );
  }

  return {
    id: "your-units",
    title: "Your own units",
    body,
    bullets,
    keyPoint:
      "A reading outside the range is not a number to write down and move past. It is the point where the check stops and a decision about the food starts.",
  };
}

// --------------------------------------------------------------------------- //
// The venue's own check schedule
// --------------------------------------------------------------------------- //

function scheduleLine(c: CourseHaccpCheck): string {
  const when =
    c.times.length > 0
      ? c.times.slice().sort().join(", ")
      : "no times set — logged as it happens";
  const days =
    c.daysOfWeek.length > 0 && c.daysOfWeek.length < 7
      ? ` (${c.daysOfWeek.map((d) => DAY_NAMES[d] ?? d).join(", ")} only)`
      : "";
  return `${c.label}: ${when}${days}`;
}

export function checksLesson(checks: CourseHaccpCheck[]): Lesson {
  const active = checks.filter((c) => c.active);

  if (active.length === 0) {
    return {
      id: "your-checks",
      title: "Your own check times",
      body: [
        "No reminder schedule has been set up here yet, so nothing prompts anybody at a fixed time.",
        "That does not make the checks optional. It makes them dependent on somebody remembering during service, which is exactly when people do not. Temperatures still have to be taken, cooking and cooling still have to be recorded, and the opening and closing rounds still have to happen.",
        "A manager can set the times under HACCP, and everybody on shift then gets prompted when a check is due. Until then, tie each check to something you already never forget: the fridge round when you unlock, the hot-holding check when you turn the bain marie on, the closing round before the last thing you do.",
      ],
      keyPoint:
        "An unscheduled check is not a check that does not matter. It is a check with nothing to catch it when service gets busy.",
    };
  }

  return {
    id: "your-checks",
    title: "Your own check times",
    body: [
      "These are the checks this venue has actually scheduled, at the times it set. When one is due, everybody on shift gets prompted — and the prompt keeps coming back until it is logged.",
      "Two things worth knowing about the times. First, they are the venue's own decision, not a legal timetable, so if a time does not fit how the kitchen really runs, say so and get it changed rather than logging it late every day. Second, a check logged at the scheduled time when it was not actually taken is worse than a missed check: it is a false record, and it is the one thing in this whole area that can turn a hygiene problem into a much more serious one.",
    ],
    bullets: active.map(scheduleLine),
    keyPoint:
      "Log what you actually did, at the time you actually did it. A gap in the record is a question to answer. A false entry is a different kind of problem entirely.",
  };
}

// --------------------------------------------------------------------------- //
// Lessons
// --------------------------------------------------------------------------- //

export function foodHygieneLessons(
  units: CourseHaccpUnit[],
  checks: CourseHaccpCheck[]
): Lesson[] {
  return [
    {
      id: "why",
      title: "Why this matters",
      body: [
        "Food poisoning is not a stomach ache. Campylobacter, salmonella, listeria and E. coli O157 put people in hospital and kill some of them — most often the very young, the very old, pregnant women and anybody whose immune system is already under pressure. Those are the people a restaurant is least likely to notice at the table.",
        "The second reason is the one that closes venues. An outbreak traced back to a kitchen becomes an inspection, a closure order in the worst cases, and a story with the venue's name in it that outlives every other thing the business has ever done well. The kitchen that caused it almost never looked dirty.",
        "This course is in-house awareness training, delivered by your employer. It is deliberately not a HACCP qualification: it does not replace the accredited course whoever manages the food safety system here is expected to hold. What it does is make sure the person actually handling food knows the numbers, the sequence and what to do when something reads wrong.",
      ],
      keyPoint:
        "Nearly every serious outbreak comes from a kitchen where everything looked fine. Looking fine is not evidence of anything.",
    },
    {
      id: "bugs",
      title: "How food actually makes people ill",
      body: [
        "Bacteria need four things to multiply: food, moisture, warmth and time. You cannot take away the food or the moisture in a kitchen, so the whole job comes down to controlling warmth and time. That is the entire logic behind every number in this course.",
        "The range where they multiply fastest is usually described as the danger zone. In the UK and Ireland it is quoted as roughly 5°C to 63°C; the US works to 41°F to 135°F, which is about 5°C to 57°C at the bottom and 57°C at the top. The exact figures differ — the principle does not. Cold slows bacteria down, heat kills them, and the space in between is where food becomes dangerous.",
        "Some bugs make it worse. Clostridium perfringens and bacillus cereus form spores that survive cooking and then grow in food left to cool slowly — which is why cooling is a controlled step and not just \"leave it out\". Staph aureus and bacillus cereus produce toxins that cooking does not destroy, so reheating something that was left out does not fix it. Listeria grows at fridge temperatures, slowly, which is why use-by dates on ready-to-eat food are not negotiable. Norovirus does not come from food at all in most cases — it comes from a person who came into work ill.",
        "None of this changes how food looks, smells or tastes. A portion of rice with enough bacillus cereus in it to hospitalise somebody looks exactly like rice.",
      ],
      bullets: [
        "Bacteria need food, moisture, warmth and time — you can only control the last two",
        "Danger zone: roughly 5°C to 63°C, depending on whose rules apply where you work",
        "Spores survive cooking, so slow cooling is its own hazard",
        "Some toxins survive reheating — reheating does not undo a mistake",
        "Listeria grows in the fridge, so use-by dates matter on ready-to-eat food",
        "Norovirus usually walks in on a person, not on food",
      ],
      keyPoint:
        "Cook it, chill it, or bin it. Food sitting at room temperature is the single most common cause of food poisoning in professional kitchens.",
    },
    {
      id: "personal",
      title: "Hands, health and turning up sick",
      body: [
        "Handwashing is the most effective single thing anybody in a kitchen does, and it is the thing done worst under pressure. Wet hands, soap, twenty seconds of actual scrubbing including thumbs, nails and wrists, rinse, dry on paper or a hand dryer — a cloth towel puts back what you just removed. Gloves change nothing about this: a gloved hand that touched raw chicken and then a salad has done exactly the same damage as a bare one.",
        "The one that people get wrong out of loyalty is coming to work ill. If you have had vomiting or diarrhoea you must not handle food, and the widely used rule is that you stay off until 48 hours after the last symptom — not until you feel better. Tell a manager rather than deciding for yourself, and tell them the same day. The same goes for an infected cut, a skin infection, a septic finger, or a household member with the same symptoms.",
        "Coming in anyway is not toughness. Norovirus takes a very small dose to pass on, and one person who worked a Saturday while unwell can put a dozen guests and half the kitchen out for a week.",
      ],
      bullets: [
        "Wash: wet, soap, 20 seconds including thumbs and nails, rinse, dry on paper",
        "Wash after raw food, bins, cleaning, the toilet, your phone, a break, and between tasks",
        "Gloves are not a substitute for washing, and they get changed between tasks",
        "Vomiting or diarrhoea: off food handling until 48 hours clear of symptoms",
        "Report cuts, skin infections and sickness to a manager the same day",
        "Cover cuts with a coloured waterproof dressing — blue, so it is visible in food",
        "No tasting with the cooking spoon, no double-dipping, clean spoon each time",
        "Tied hair, clean apron, no watch or stoned rings, short clean nails, no nail polish",
      ],
      keyPoint:
        "48 hours clear of symptoms, not 48 hours since you felt rough. And tell somebody — do not make that call on your own.",
    },
    {
      id: "four-cs",
      title: "The four Cs",
      body: [
        "Almost every food safety control in the world sorts into four headings: cleaning, cooking, chilling and avoiding cross-contamination. If you can hold those four in your head you can work out the right answer to most situations nobody trained you for.",
        "Cross-contamination is the one that causes the most harm in practice, and it is rarely dramatic. It is the board that got wiped instead of washed, the tongs that went from raw to cooked, the raw chicken stored above the dressed salad, the cloth used on everything, the knife rinsed under a tap and put straight back into service. Raw meat, poultry, fish and eggs are the sources that matter most, and unwashed vegetables and soil are a close second.",
        "Cleaning has two stages and people routinely do one. Clean first to remove the grease and debris, then sanitise — and sanitiser needs its contact time to work, which means leaving it wet for as long as the label says instead of wiping it straight off. A surface wiped with a dirty cloth and a squirt of sanitiser is cleaner in appearance and no safer at all.",
      ],
      bullets: [
        "Separate boards, knives and surfaces for raw and ready-to-eat, or a full clean-down between",
        "Store raw below and away from ready-to-eat food, always, and covered",
        "Clean first, then sanitise, and respect the contact time on the label",
        "Clean as you go — a pile of it at the end gets done badly",
        "Change cloths often; a reused cloth spreads more than it removes",
        "Wash hands between raw and ready-to-eat, every time",
        "Keep food covered and off the floor, and never store anything under a raw drip line",
      ],
      keyPoint:
        "Raw goes below cooked, never above it. Gravity does not care how careful you are.",
    },
    {
      id: "temps",
      title: "The numbers that matter",
      body: [
        "These are the figures your own HACCP module marks against, which is what makes them the ones to learn. They are widely used rather than universal — hot-holding minimums, fridge maximums and core cooking temperatures all vary between countries, and several of these are deliberately set tighter here than the legal maximum. Where you work, check the local rule.",
        "Two practical points about probes. Take a core temperature in the thickest part, away from bone and away from the base of the pan, and give it time to settle rather than reading the first number. And clean and sanitise the probe between uses — a probe that goes from raw chicken into a cooked dish carries everything with it, which makes the tool for checking safety the thing that broke it.",
        "Cooling is the step most often skipped, and the one that causes the most avoidable outbreaks. Food has to get through the danger zone quickly: this venue's module records 60°C down to below 4°C within four hours. Break the batch down, use shallow trays, an ice bath or a blast chiller — a full stockpot left on the side will not do it and cannot be made to.",
      ],
      bullets: [
        "Fridge and cold room: held at 1 to 4°C here",
        "Freezer: -18°C or colder — the module records -25 to -18°C",
        "Hot holding: above 63°C (60°C / 140°F in the US)",
        "Cooking: core above 75°C, taken in the thickest part",
        "Cooling: 60°C to below 4°C within four hours",
        "Reheating: commonly 70°C for two minutes or 75°C, depending on local rules — once only, never twice",
        "Chilled deliveries: check the temperature on arrival, and reject rather than accept-and-hope",
        "Use-by is a safety date and is not negotiable. Best-before is about quality",
      ],
      keyPoint:
        "Reheat once, never twice, and take the core temperature rather than judging by the steam.",
    },
    unitLesson(units),
    checksLesson(checks),
    {
      id: "when-it-fails",
      title: "When a check fails",
      body: [
        "A reading outside the range is not a paperwork problem. It is the moment the check has done its job, and the moment a decision about food has to be made by somebody senior enough to make it.",
        "The sequence is the same every time: record the real reading, tell a manager or chef now rather than at the end of service, and make a decision about the food before anything else. How long has it been out of range? A fridge found at 9°C first thing in the morning has been wrong all night and everything in it is suspect; the same fridge at 9°C twenty minutes after a delivery round is a door that was left open. Those are different situations with different answers, and neither of them is \"write it down and carry on\".",
        "Then fix the cause and write down what you did — that is what a corrective action record is for. \"Fridge at 9°C, food transferred to walk-in, engineer called, unit back at 3°C by 14:00\" is a venue managing a hazard. A log with nothing but passes in it, in a kitchen with a fridge everybody knows is unreliable, is a venue with a problem and no record of it.",
        "One thing never to do: do not write a pass for a check you did not take, and do not adjust a number to keep the sheet clean. Everybody understands why it happens on a bad night. It turns a hygiene issue into a falsified record, it destroys the value of every honest entry beside it, and it is the fastest way to lose the benefit of the doubt from an inspector who would otherwise have given it.",
      ],
      bullets: [
        "Record the real reading, not the one you wanted",
        "Tell a manager or chef immediately, not at the end of service",
        "Decide about the food first: how long was it out of range?",
        "Move, use immediately, or discard — a senior decision, not a solo one",
        "Fix the cause and log the corrective action",
        "Never write a pass for a check you did not take",
      ],
      keyPoint:
        "A failed check that is recorded and acted on is the system working. A failed check quietly logged as a pass is the only version that gets somebody hurt.",
    },
    {
      id: "records",
      title: "The record is the proof",
      body: [
        "Nobody can go back and inspect last Tuesday's fridge. The record of last Tuesday is the only version of it that exists, which is why the paperwork carries so much weight in an area that is otherwise all practical.",
        "Sign your own checks and nobody else's. An entry against your name says you personally took that reading at that time. If a check was missed, the honest thing is a gap and a note about why — an inspector reads the gaps, but a gap with an explanation reads as a busy kitchen being straight about it, while a suspiciously perfect sheet reads as something else entirely.",
        "This course itself is a record. Passing it files an in-house training record against your name, valid for twelve months, and the app will chase the retrain when it comes due. It is proof your employer instructed you — deliberately not a HACCP qualification, and it does not pretend to be one.",
      ],
      keyPoint:
        "Log it at the time, under your own name, honestly. A record written to look good is worth less than no record at all.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Knowledge questions
// --------------------------------------------------------------------------- //

export function foodHygieneBank(): QuizQuestion[] {
  return [
    {
      id: "f-danger-zone",
      kind: "single",
      prompt: "Why does the temperature range between about 5°C and 63°C matter?",
      options: [
        "It is the range where food loses flavour fastest",
        "It is the range where bacteria multiply fastest",
        "It is the range a fridge should be set to",
        "It is the range that kills most bacteria",
      ],
      correct: [1],
      why: "It is the danger zone — the range where bacteria multiply fastest. The exact figures vary by country, but the principle behind every temperature rule is the same.",
    },
    {
      id: "f-fridge",
      kind: "single",
      prompt: "A fridge should be holding food at which of these?",
      options: ["1 to 4°C", "8 to 12°C", "Below -18°C", "Above 63°C"],
      correct: [0],
      why: "This venue's module marks fridges against 1 to 4°C. That is tighter than the legal maximum in several countries on purpose — a unit sitting at the limit has no headroom on a hot day.",
    },
    {
      id: "f-freezer",
      kind: "single",
      prompt: "What temperature should a freezer be at or below?",
      options: ["0°C", "-5°C", "-18°C", "-40°C"],
      correct: [2],
      why: "-18°C or colder is the figure used almost everywhere. The module records a range of -25 to -18°C.",
    },
    {
      id: "f-hothold",
      kind: "single",
      prompt: "Food being held hot on the pass must be kept above which temperature?",
      options: ["45°C", "55°C", "63°C", "75°C"],
      correct: [2],
      why: "63°C is the UK and Ireland figure for hot holding, and it is what this venue's module marks against. The US works to 60°C (140°F).",
    },
    {
      id: "f-core",
      kind: "single",
      prompt: "Where do you take the core temperature of a cooked item, and what are you looking for?",
      options: [
        "On the surface, once it looks browned",
        "In the thickest part, looking for above 75°C",
        "Next to the bone, looking for above 63°C",
        "Anywhere in the pan, looking for steam",
      ],
      correct: [1],
      why: "Thickest part, away from bone and away from the base of the pan, and above 75°C core on this venue's setting. Give the probe time to settle rather than reading the first number.",
    },
    {
      id: "f-reheat",
      kind: "single",
      prompt: "A portion of yesterday's ragu is going out tonight. What is correct?",
      options: [
        "Reheat it once, right through, and never reheat it again",
        "Reheat it as many times as needed as long as it is piping hot each time",
        "Warm it to serving temperature — it was already cooked yesterday",
        "Reheat it twice at most",
      ],
      correct: [0],
      why: "Reheat once only, right through to the required temperature. Repeated trips through the danger zone are exactly what cooling and reheating rules exist to prevent.",
    },
    {
      id: "f-cooling",
      kind: "single",
      prompt: "A large stockpot of soup comes off the stove at the end of service. What is the correct way to cool it?",
      options: [
        "Leave it on the side overnight and refrigerate in the morning",
        "Put the whole pot straight into the walk-in",
        "Break it into shallow trays or use an ice bath, and get it below 4°C within four hours",
        "Cool it uncovered next to an open window",
      ],
      correct: [2],
      why: "Break the batch down so it cools fast — 60°C to below 4°C within four hours on this venue's setting. A full stockpot cannot do that, and a hot pot in the walk-in warms everything around it.",
    },
    {
      id: "f-lookfine",
      kind: "single",
      prompt: "A tray of rice was left out at room temperature for five hours. It looks and smells perfectly fine. What do you do?",
      options: [
        "Use it — it looks and smells fine",
        "Reheat it thoroughly and then use it",
        "Discard it",
        "Refrigerate it now and use it tomorrow",
      ],
      correct: [2],
      why: "Bacillus cereus spores survive cooking, grow in rice left in the danger zone, and produce a toxin that reheating does not destroy. It looks and smells completely normal. Discard it.",
    },
    {
      id: "f-handwash",
      kind: "multi",
      prompt: "Which of these are true about handwashing in a kitchen?",
      note: "Select all that apply.",
      options: [
        "Twenty seconds of scrubbing, including thumbs, nails and wrists",
        "Gloves remove the need to wash between tasks",
        "Dry on paper or a hand dryer, not a cloth towel",
        "Wash after handling raw food, bins, your phone and a break",
      ],
      correct: [0, 2, 3],
      why: "Gloves change nothing — a gloved hand that touched raw chicken and then a salad has done the same damage. A cloth towel puts back what you just removed.",
    },
    {
      id: "f-sickness",
      kind: "single",
      prompt: "You had diarrhoea yesterday and feel fine this morning. You are on the rota for lunch. What is correct?",
      options: [
        "Come in — you feel fine now",
        "Come in but wear gloves and stay off the cold section",
        "Tell a manager and stay off food handling until 48 hours after the last symptom",
        "Come in and go home again if it returns",
      ],
      correct: [2],
      why: "The widely used rule is 48 hours clear of symptoms, not until you feel better. Tell a manager the same day rather than deciding for yourself.",
    },
    {
      id: "f-cuts",
      kind: "single",
      prompt: "You cut your finger during prep. What do you do?",
      options: [
        "Cover it with any plaster and keep going",
        "Clean it, cover it with a blue waterproof dressing, and tell a manager",
        "Wrap it in blue roll and finish the section",
        "Wear a glove over it and say nothing",
      ],
      correct: [1],
      why: "A coloured waterproof dressing — blue, because nothing in food is naturally blue, so it is visible if it comes off. And it gets reported.",
    },
    {
      id: "f-raw-storage",
      kind: "single",
      prompt: "Where should raw chicken be stored in a fridge that also holds dressed salads?",
      options: [
        "On the top shelf, so it is easy to reach",
        "On the bottom shelf, covered, below the ready-to-eat food",
        "Anywhere, as long as both are covered",
        "Next to the salads on the same shelf, clearly labelled",
      ],
      correct: [1],
      why: "Raw goes below ready-to-eat, always, and covered. If it drips, gravity decides what it lands on.",
    },
    {
      id: "f-boards",
      kind: "single",
      prompt: "You have just boned out raw chicken and the same board is needed for salad garnish. What is correct?",
      options: [
        "Wipe it down with a sanitiser cloth and carry on",
        "Turn it over and use the other side",
        "Use a different clean board, or fully wash and sanitise this one first",
        "Rinse it under a hot tap",
      ],
      correct: [2],
      why: "A wipe is not a wash, and the other side of a board is not a clean board. Swap it, or wash and sanitise properly.",
    },
    {
      id: "f-twostage",
      kind: "single",
      prompt: "What does cleaning a food surface properly involve?",
      options: [
        "A single spray of sanitiser wiped straight off",
        "Cleaning to remove debris first, then sanitising and leaving it the contact time on the label",
        "Hot water alone, as long as it is very hot",
        "Sanitiser first, then a rinse with cold water",
      ],
      correct: [1],
      why: "Two stages. Clean to remove grease and debris, then sanitise — and sanitiser needs its contact time, which means leaving it wet rather than wiping it off immediately.",
    },
    {
      id: "f-probe",
      kind: "single",
      prompt: "You have just probed a raw chicken breast. The next thing to probe is a cooked lasagne. What has to happen first?",
      options: [
        "Nothing — the probe was in a hot item",
        "Wipe it on a cloth",
        "Clean and sanitise the probe",
        "Let it cool down",
      ],
      correct: [2],
      why: "Clean and sanitise the probe between uses. Otherwise the tool you check safety with becomes the thing that carried the contamination.",
    },
    {
      id: "f-useby",
      kind: "multi",
      prompt: "Which of these statements are correct?",
      note: "Select all that apply.",
      options: [
        "Use-by is a safety date and food must not be used after it",
        "Best-before is about quality rather than safety",
        "Use-by can be extended if the food still looks and smells fine",
        "Listeria can grow slowly at fridge temperatures",
      ],
      correct: [0, 1, 3],
      why: "A use-by date is not negotiable, and it exists precisely because organisms like listeria keep growing in the fridge without changing how the food looks or smells.",
    },
    {
      id: "f-delivery",
      kind: "single",
      prompt: "A chilled delivery arrives and the driver is in a hurry. The probe reads 11°C. What do you do?",
      options: [
        "Accept it and get it into the fridge quickly to bring it down",
        "Accept it and note the temperature on the delivery record",
        "Reject it, record the reading and the rejection, and tell a manager",
        "Accept it but use it the same day",
      ],
      correct: [2],
      why: "Reject it and record why. Getting a warm chilled delivery cold again does not undo the time it spent in the danger zone, and \"the driver was in a hurry\" is not a food safety control.",
    },
    {
      id: "f-defrost",
      kind: "single",
      prompt: "What is the correct way to defrost a frozen joint of meat?",
      options: [
        "On the bench overnight, covered",
        "In the fridge, covered, on a tray below ready-to-eat food",
        "In a sink of warm water",
        "In the hot-holding unit on its lowest setting",
      ],
      correct: [1],
      why: "In the fridge, covered, on a tray to catch the drip, stored below ready-to-eat food. Defrosting on the bench leaves the outside in the danger zone for hours while the middle is still frozen.",
    },
    {
      id: "f-tasting",
      kind: "single",
      prompt: "You need to taste a sauce you are working on. What is correct?",
      options: [
        "Taste from the cooking spoon and put it back",
        "Use a clean spoon each time and never return it to the pan",
        "Taste from the ladle, then rinse it",
        "Use a finger — it is faster",
      ],
      correct: [1],
      why: "Clean spoon, once, and it does not go back in. Double-dipping puts your mouth directly into food that is going out to guests.",
    },
    {
      id: "f-pest",
      kind: "single",
      prompt: "You find mouse droppings behind the dry store shelving. What do you do?",
      options: [
        "Clean them up and say nothing — it was only a few",
        "Clean them up and mention it if it happens again",
        "Tell a manager now and get it logged in the pest control record",
        "Put down a trap yourself and check it tomorrow",
      ],
      correct: [2],
      why: "Report it and log it the same day. Pest activity has to be recorded and dealt with by whoever is contracted to do it — one sighting cleaned away quietly is how an infestation gets time to establish.",
    },
    {
      id: "f-fail",
      kind: "single",
      prompt: "The morning fridge check reads 9°C. What is the correct sequence?",
      options: [
        "Write down 9°C and check it again at lunchtime",
        "Turn the fridge down and log a pass once it recovers",
        "Record the real reading, tell a manager now, and decide about the food before anything else",
        "Move the food and log it at the end of service",
      ],
      correct: [2],
      why: "Record what it actually read, escalate immediately, and make a decision about the food first — a fridge at 9°C first thing has been wrong all night, and everything in it is suspect.",
    },
    {
      id: "f-falsify",
      kind: "single",
      prompt: "Service was chaotic and the hot-holding check never got taken. The sheet has a gap. What is the right thing to do?",
      options: [
        "Fill in a plausible temperature so the sheet is complete",
        "Leave the gap, note why it was missed, and tell a manager",
        "Copy the reading from the previous check",
        "Take the reading now and write it under the earlier time",
      ],
      correct: [1],
      why: "A gap with an honest note reads as a busy kitchen being straight. An invented entry is a falsified record — it destroys the credibility of every honest entry beside it.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Questions built from the venue's own units
// --------------------------------------------------------------------------- //

/** The four target ranges, used as option sets so decoys are always real. */
const RANGE_OPTIONS = ["1 to 4°C", "-25 to -18°C", "above 63°C", "8 to 12°C"];

export function unitQuestions(units: CourseHaccpUnit[], seed: number): QuizQuestion[] {
  if (units.length === 0) {
    // Nothing recorded. Test the instinct rather than inventing a unit list.
    return [
      {
        id: "h-empty",
        kind: "single",
        prompt:
          "No named units have been added to your HACCP equipment list. A temperature log here just says \"fridge\". What is the problem with that?",
        options: [
          "Nothing — a reading is a reading",
          "It cannot show which unit was checked, so it cannot show which one was missed or which one keeps failing",
          "It only matters if you have more than ten fridges",
          "It is fine as long as the same person does the checks every day",
        ],
        correct: [1],
        why: "A generic log cannot prove which unit was checked, cannot show a missed unit, and cannot show a pattern on the one unit that keeps drifting. Named units are what make the record mean something.",
      },
    ];
  }

  const out: QuizQuestion[] = [];
  const freezers = units.filter((u) => u.type === "freezer");
  const fridges = units.filter((u) => u.type === "fridge");
  const hot = units.filter((u) => u.type === "hot_holding");

  // 1. The target range for one real named unit.
  const targeted = shuffled(
    units.filter((u) => u.min !== null || u.max !== null),
    seed + 3
  )[0];
  if (targeted) {
    const options = shuffled(RANGE_OPTIONS, seed + targeted.id.length);
    const answer = options.indexOf(targeted.target);
    if (answer >= 0) {
      out.push({
        id: `h-target-${targeted.id}`,
        kind: "single",
        prompt: `Your HACCP list records "${targeted.name}" as a ${targeted.typeLabel.toLowerCase()} unit. What range should it be holding?`,
        note: "This is your own venue's recorded equipment.",
        options,
        correct: [answer],
        why: `${targeted.name} is a ${targeted.typeLabel.toLowerCase()} unit, so it is marked against ${targeted.target}.`,
      });
    }
  }

  // 2. Sort their own units by type — only when there is something to sort.
  if (freezers.length > 0 && freezers.length < units.length) {
    const pool = shuffled(units, seed + 11).slice(0, Math.min(6, units.length));
    const withFreezer = pool.some((u) => u.type === "freezer")
      ? pool
      : [freezers[0], ...pool.slice(0, 5)];
    const options = withFreezer.map((u) => u.name);
    const correct = withFreezer
      .map((u, i) => (u.type === "freezer" ? i : -1))
      .filter((i) => i >= 0);
    if (correct.length > 0 && correct.length < options.length) {
      out.push({
        id: "h-classify",
        kind: "multi",
        prompt: "Which of these units on your own list are freezers, held at -18°C or colder?",
        note: "Select all that apply. Everything else here is held at fridge or hot-holding temperature.",
        options,
        correct,
        why: `Freezers on your list: ${withFreezer
          .filter((u) => u.type === "freezer")
          .map((u) => u.name)
          .join(", ")}. Everything else is held at a completely different end of the scale.`,
      });
    }
  }

  // 3. A real hot-holding unit reading under 63°C mid-service.
  const hotUnit = shuffled(hot, seed + 17)[0];
  if (hotUnit) {
    out.push({
      id: `h-hot-${hotUnit.id}`,
      kind: "single",
      prompt: `The two-hourly check on "${hotUnit.name}" reads 55°C in the middle of service. What do you do?`,
      options: [
        "Log it and turn the unit up a little",
        "Record the real reading, tell the chef now, and get a decision on the food before it goes out",
        "Log it as a pass — 55°C is still hot",
        "Move the food to a hotter part of the unit and re-check at the next scheduled time",
      ],
      correct: [1],
      why: `${hotUnit.name} is held above 63°C. At 55°C the food has been in the danger zone for an unknown part of the last two hours, so the reading gets recorded honestly and somebody senior decides about the food.`,
    });
  }

  // 4. A real fridge failing the morning check.
  const fridgeUnit = shuffled(fridges, seed + 23)[0];
  if (fridgeUnit) {
    out.push({
      id: `h-fridge-${fridgeUnit.id}`,
      kind: "single",
      prompt: `You unlock in the morning and the first check on "${fridgeUnit.name}" reads 11°C. What is the most important thing about that reading?`,
      options: [
        "It is only slightly over, so a re-check later will do",
        "It has been out of range for an unknown number of hours overnight, so everything in it is suspect",
        "It just needs the door checked and the temperature logged",
        "It is fine as long as the food still feels cold",
      ],
      correct: [1],
      why: `A morning reading of 11°C on ${fridgeUnit.name} says nothing about when it drifted — it could have been all night. That makes it a decision about the food, taken with a manager, not a number to write down and move past.`,
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
 * The floor of 8 knowledge questions means a venue with a long equipment list
 * still gets a course about food hygiene rather than a quiz about its own
 * fridges.
 */
export function foodHygieneQuiz(units: CourseHaccpUnit[], seed: number): QuizQuestion[] {
  const fromUnits = unitQuestions(units, seed);
  const wanted = 12;
  const knowledge = shuffled(foodHygieneBank(), seed).slice(
    0,
    Math.max(8, wanted - fromUnits.length)
  );
  return shuffled([...fromUnits, ...knowledge], seed + 31);
}
