/**
 * Fire safety awareness — in-house course content.
 *
 * ── What this is ────────────────────────────────────────────────────────────
 * Employer-delivered fire safety AWARENESS for kitchen and floor staff, plus
 * the venue's own equipment register woven into it. Cooking is the single
 * biggest cause of fire in food-service premises, and the equipment that causes
 * it is already recorded in Rotahr, so the lesson can name the actual fryers,
 * ovens and extraction in the building.
 *
 * ── What this is NOT ────────────────────────────────────────────────────────
 * It is NOT fire warden or fire marshal training, and it is NOT a substitute for
 * the venue's fire risk assessment. Those are separate, usually externally
 * delivered, and a warden role in particular requires hands-on practice with
 * evacuation procedures for that specific building. Never let the copy imply
 * otherwise: a certificate claiming a warden qualification, shown to a fire
 * officer after an incident, is far worse than having no course at all.
 *
 * Fire rules vary far more by country than food rules do — test frequencies,
 * drill frequencies, extinguisher provision, who must be appointed. Every figure
 * here is stated as common practice with a nudge to check local requirements.
 */

import {
  type CourseAsset,
  type Lesson,
  type QuizQuestion,
  niceDate,
  shuffled,
} from "./kit";

const CATEGORY_LABEL: Record<string, string> = {
  cooking: "cooking",
  hvac: "extraction / HVAC",
  electrical: "electrical",
  refrigeration: "refrigeration",
  dishwashing: "dishwashing",
  bar: "bar",
  coffee: "coffee",
  plumbing: "plumbing",
  pos: "till / POS",
  furniture: "furniture",
  other: "other",
};

function label(a: CourseAsset): string {
  const bits: string[] = [];
  if (a.location) bits.push(a.location);
  bits.push(CATEGORY_LABEL[a.category] ?? a.category);
  return `${a.name} — ${bits.join(", ")}`;
}

// --------------------------------------------------------------------------- //
// The venue-data lesson
// --------------------------------------------------------------------------- //

function equipmentLesson(assets: CourseAsset[]): Lesson {
  const live = assets.filter((a) => a.status !== "retired");
  const risky = live.filter((a) => a.fireRisk);
  const fryers = risky.filter((a) => a.fryer);
  const overdue = risky.filter((a) => a.serviceOverdue);

  if (risky.length === 0) {
    const partial = live.length > 0;
    return {
      id: "your-equipment",
      title: "Your own equipment",
      body: [
        partial
          ? `This lesson normally lists the fire-risk equipment recorded in your own building — the fryers, ranges, grills, extraction and electrical plant. Your register has ${live.length} ${
              live.length === 1 ? "item" : "items"
            } on it, but none of them are recorded under cooking, extraction or electrical, so there is nothing to name here.`
          : "This lesson normally lists the fire-risk equipment recorded in your own building — the fryers, ranges, grills, extraction and electrical plant. Nothing is recorded yet, so there is nothing to show.",
        partial
          ? "That usually means the register is part-built rather than that the kitchen has no hot equipment. A manager can add the rest under Log book → Equipment, and set the category correctly while doing it — that is what tells this course, and the service reminders, which items matter most."
          : "A manager can build the register under Log book → Equipment. It is worth doing for its own sake: it is where service dates and warranty details live. Once it is filled in, this lesson and the questions at the end name your actual equipment instead of talking in general terms.",
        "In the meantime, do the walk yourself. Find the fryers, the gas isolation valve, the extraction canopy, the electrical distribution board, the fire alarm call points, the extinguishers and the assembly point. Somebody on every shift has to know where those are without looking.",
      ],
      keyPoint:
        "A register with no fire-risk equipment on it is not evidence that the building has none. It only means nobody has written it down yet.",
    };
  }

  const body = [
    "This is the part no outside training provider can give you: the fire-risk equipment recorded in this building, by name.",
    `Your register lists ${risky.length} ${
      risky.length === 1 ? "item" : "items"
    } that carry a real fire risk — cooking equipment, extraction, or electrical plant. Read the list. You are not being asked to memorise it; you are being asked to know what is in the room you work in and which of it can start a fire.`,
  ];

  if (fryers.length > 0) {
    body.push(
      `${fryers.length === 1 ? "One item holds" : `${fryers.length} items hold`} hot oil: ${fryers
        .map((f) => f.name)
        .join(", ")}. That is the highest-consequence fire risk in most kitchens, and it is the one where using the wrong extinguisher makes it dramatically worse.`
    );
  }

  if (overdue.length > 0) {
    body.push(
      `${
        overdue.length === 1 ? "One of these is" : `${overdue.length} of these are`
      } past the service date recorded against ${overdue.length === 1 ? "it" : "them"}: ${overdue
        .map((a) => `${a.name} (was due ${niceDate(a.nextServiceDate)})`)
        .join(", ")}. An overdue service on gas, cooking or extraction equipment is not paperwork — a failing thermostat on a fryer or a clogged extraction run is exactly how these fires start. Tell a manager.`
    );
  }

  return {
    id: "your-equipment",
    title: "Your own equipment",
    body,
    bullets: risky.map((a) => {
      const service = a.nextServiceDate
        ? a.serviceOverdue
          ? ` — service OVERDUE, was due ${niceDate(a.nextServiceDate)}`
          : ` — next service ${niceDate(a.nextServiceDate)}`
        : " — no service date recorded";
      const flag = a.status && a.status !== "active" ? ` [${a.status.replace(/_/g, " ")}]` : "";
      return `${label(a)}${service}${flag}`;
    }),
    keyPoint:
      "Faults are fire risks. A plug that gets warm, a flex with the braid showing, a fryer whose thermostat overshoots, a canopy filter nobody has taken out in a month — all of it gets reported the same shift, not next week.",
  };
}

// --------------------------------------------------------------------------- //
// Lessons
// --------------------------------------------------------------------------- //

export function fireLessons(assets: CourseAsset[]): Lesson[] {
  return [
    {
      id: "why",
      title: "Why a kitchen is different",
      body: [
        "Cooking is the leading cause of fire in food-service premises almost everywhere it is measured. That is not surprising: a commercial kitchen deliberately keeps open flame, hot surfaces and large volumes of oil running for twelve hours a day, in a room where people are moving fast, with grease building up inside ductwork nobody looks at.",
        "The building makes it worse. Guests do not know where your exits are. Some of them have had a drink. Staff know the back-of-house route, which is often the route that fills with smoke first. Above the kitchen there may be function rooms or bedrooms.",
        "Smoke is what kills, not flame. A kitchen fire produces thick, black, fat-laden smoke within seconds, and two or three breaths of it will put an adult on the floor. That is why the whole procedure is built around raising the alarm and getting people out early rather than heroics.",
        "In most countries the operator is required to carry out a fire risk assessment, keep escape routes clear and usable, provide appropriate fire-fighting equipment and detection, and make sure staff are instructed in what to do. The specific figures — how often the alarm is tested, how often a drill is run, who must be formally appointed — differ from country to country. Check your own local requirements rather than relying on any figure in training material, including this course.",
      ],
      keyPoint:
        "You do not have to be brave. You have to raise the alarm early and get people out. Everything else is optional.",
    },
    {
      id: "how-fires-start",
      title: "Fuel, heat, air — and where each one lives in your building",
      body: [
        "A fire needs three things: something to burn, something to start it, and oxygen. Take one away and it stops. Every control in this course is one of those three, and knowing which is which makes the rules stop feeling arbitrary.",
        "The fuel in a hospitality building is not just the obvious oil in the fryer. It is the grease coating the inside of the canopy and the ducting, the cardboard stacked in the corridor because the bins are full, the linen bag by the dryer, the spirits behind the bar, the aerosols and the cleaning chemicals, the LPG bottles by the back door.",
        "The heat sources are the ones you use all day, plus the ones nobody thinks about: pass lamps left on over an empty pass, a phone charger under a bar shelf, a dishwasher element, a tumble dryer full of lint, a smoking bin at the back door emptied into a cardboard bale, candles on tables at the end of a long service.",
        "Oxygen is the one people give away for free, every day, by wedging a fire door open because the kitchen is hot. A fire door is not decoration. It is the thing that buys the people on the floor above the minutes they need.",
      ],
      bullets: [
        "Hot oil and fat — the biggest single risk, and the fastest to become uncontrollable",
        "Grease in canopy filters and extraction ducting — the reason a kitchen fire becomes a building fire",
        "Cardboard, packaging and dry goods stacked near hot equipment",
        "Linen, lint and a tumble dryer nobody cleans out",
        "Spirits, aerosols and flammable cleaning products",
        "Damaged flexes, overloaded sockets and daisy-chained extension leads",
        "Smoking materials at the back door, and the bin they go into",
        "Wedged-open fire doors, which turn a contained fire into a building fire",
      ],
      keyPoint:
        "A propped-open fire door is the most common serious fire safety failure in hospitality, and the easiest to fix. Unwedge it, every time, without being asked.",
    },
    {
      id: "prevention",
      title: "What actually prevents fires",
      body: [
        "Almost none of fire safety is fire-fighting. It is a short list of dull habits, done every shift, that stop a fire starting at all — and they are all things a chef or a bartender controls personally rather than something a manager does once a year.",
        "The single biggest one: never leave hot oil or a pan on direct heat unattended. Not for a delivery, not for a phone call, not for the thirty seconds it takes to go to the walk-in. Cooking oil left on heat will reach its auto-ignition temperature and light with no spark at all, and it does that faster than most people expect.",
        "The second biggest: degreasing. Filters out and through the wash every day, canopy wiped, and full duct cleaning by a competent contractor at whatever interval your risk assessment sets. Grease inside a duct is a fuse running through the ceiling void.",
      ],
      bullets: [
        "Never leave fryers, pans or grills unattended while hot",
        "Keep a lid or a fire blanket within reach of the fryers and know where it is",
        "Pull and wash canopy filters daily; report grease build-up you cannot reach",
        "Keep cardboard, packaging and linen away from hot equipment and out of corridors",
        "Never daisy-chain extension leads; report warm plugs, scorch marks and damaged flexes the same shift",
        "Switch off and isolate equipment at close — not standby",
        "Empty smoking bins into a metal container, never into a cardboard bale",
        "Keep escape routes, exits and extinguishers clear — a delivery left in the corridor is a blocked exit",
        "Close doors at close of business; closed doors slow a fire down overnight",
      ],
      keyPoint:
        "Unattended cooking is the leading cause of these fires. Everything else on this list matters less than that one.",
    },
    equipmentLesson(assets),
    {
      id: "on-discovery",
      title: "When you find a fire, or the alarm goes",
      body: [
        "Raise the alarm first. Before you look for an extinguisher, before you shout at the kitchen, before you decide how bad it is — hit the nearest call point. Every second spent assessing is stolen from whoever is upstairs or in the toilets and cannot smell anything yet.",
        "Then call the fire service, or make sure somebody has. Do not assume the alarm calls them, do not assume a manager has done it, and do not wait until you have decided you cannot handle it yourself. A fire service called and stood down costs nothing. A fire service called four minutes late costs a building.",
        "Get people out. Guests will argue: they will want their coats, their bags, to settle the bill, to finish a drink, to film it. The answer is the same every time, politely and without negotiating — leave now, we will sort it out at the assembly point. Do not let anyone go back upstairs or into a bedroom.",
        "If it is on your way out and safe, isolate the gas and shut down cooking equipment. If it is not on your way out, leave it. Nobody has ever been praised for going deeper into a burning building to switch something off.",
        "At the assembly point, do a roll call. In a venue that is the clock-in list and the rota, plus a sensible headcount of guests. Report anybody missing to the fire service the moment they arrive — that is the information only you have and only for a few minutes.",
        "Then nobody goes back in. Not for a phone, not for the till, not for a dog, not because it looks like it has gone out. Only the fire service says when the building is safe.",
      ],
      bullets: [
        "Raise the alarm at the nearest call point — first, always",
        "Call the fire service, or confirm out loud that somebody has",
        "Evacuate guests by the nearest safe exit; do not use lifts",
        "Do not let anyone collect belongings, pay a bill, or go back upstairs",
        "Close doors behind you as you leave",
        "Isolate gas and cooking equipment only if it is safe and on your way out",
        "Go to the assembly point and do a roll call from the clock-in list and rota",
        "Report anybody missing to the fire service immediately",
        "Never re-enter until the fire service says the building is safe",
      ],
      keyPoint:
        "Alarm first, fire service second, people out third. Fighting the fire is fourth and optional.",
    },
    {
      id: "extinguishers",
      title: "Extinguishers — and the two that will make things worse",
      body: [
        "Only think about tackling a fire if all of these are true: it is small and not spreading, you know which extinguisher is right, your escape route is behind you, and somebody else has already raised the alarm. You get one attempt. If it does not go out, put it down and leave.",
        "The one that matters most in a kitchen is wet chemical, usually marked Class F and often yellow-labelled. It is the fryer extinguisher: it reacts with the hot fat to form a soapy crust over the surface, cutting off the oxygen and cooling it. Nothing else does that job properly.",
        "Water on burning fat is the mistake that turns an incident into a hospital visit. Water hitting oil at frying temperature flashes to steam instantly and throws burning oil up and out across the kitchen — and across whoever is holding the extinguisher. Never water, never a wet cloth, and never carry a burning pan anywhere.",
        "The other common error is dry powder indoors. It works on almost everything, which is why it ends up bought for kitchens, but discharging it in an enclosed room destroys visibility in seconds — including your view of the exit — and contaminates every food surface in the building. It is generally an outdoor and forecourt extinguisher.",
        "CO2 is the electrical one: it displaces oxygen and leaves no residue, so a distribution board or a piece of live plant can survive it. Two limitations worth knowing: it does not cool the fuel, so a fire can reignite once the gas disperses, and the horn gets cold enough to injure your hand if you hold it.",
      ],
      bullets: [
        "Wet chemical (Class F) — cooking oil and fat. The fryer extinguisher",
        "Fire blanket — small pan fires, and it is what you put over a person whose clothing is on fire",
        "CO2 — electrical equipment and live plant; no residue, but can reignite, and never hold the horn",
        "Water or water-additive — paper, wood, textiles. Never on fat, never on live electrics",
        "Foam — flammable liquids; not for deep-fat fryers",
        "Dry powder — versatile but blinding indoors; generally outdoor use",
        "One attempt, escape route behind you, alarm already raised — or do not start",
      ],
      keyPoint:
        "A fryer fire takes wet chemical or a blanket. Water on burning fat erupts and spreads it — that single fact is the most important thing in this course after \"raise the alarm\".",
    },
    {
      id: "records",
      title: "Drills, records, and the awkward question",
      body: [
        "Fire safety in a business is judged on evidence, and the evidence is boring: a current fire risk assessment, an alarm test log, extinguisher service dates, a drill record, and training records for the people on shift. This course produces one of those records, dated and signed by you.",
        "Weekly alarm testing and drills once or twice a year are common practice in a lot of jurisdictions, but the actual requirement, and who is allowed to sign off what, varies by country and sometimes by building. Your risk assessment is the document that decides it for your venue — not this course.",
        "The gap that catches hospitality specifically is turnover and agency cover. Somebody starting on a Friday night needs to be shown the exits, the assembly point and the alarm points before service, not at their induction meeting the following Tuesday. If you are the one who knows, you are the one who tells them.",
        "The same goes for guests who cannot use the stairs, deliveries blocking a fire exit, and lone working at close. Any of those is worth raising before it matters rather than explaining afterwards.",
      ],
      bullets: [
        "Fire risk assessment — kept current and actually read",
        "Alarm and emergency lighting test log",
        "Extinguisher service record",
        "Drill record, including how long the evacuation took",
        "Training records — including this one",
        "New starters and agency staff briefed on exits before their first service",
        "A plan for guests who cannot use the stairs",
      ],
      keyPoint:
        "The question after an incident is always \"show me that this person was trained\". A dated, signed record is the answer. A memory of a chat in the kitchen is not.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Knowledge questions
// --------------------------------------------------------------------------- //

export function fireBank(): QuizQuestion[] {
  return [
    {
      id: "f-first-action",
      kind: "single",
      prompt: "You walk into the kitchen and find a fire in the extraction canopy. What do you do first?",
      options: [
        "Find the right extinguisher and try to put it out",
        "Raise the alarm at the nearest call point",
        "Look for a manager to tell them",
        "Turn off the gas and the cooking equipment",
      ],
      correct: [1],
      why: "The alarm goes first, every time. Anything else delays the people who cannot yet smell smoke — and delays the fire service.",
    },
    {
      id: "f-fryer-media",
      kind: "single",
      prompt: "The oil in a deep-fat fryer catches fire. Which is the correct thing to use?",
      options: [
        "Water extinguisher",
        "Wet chemical extinguisher (Class F) or a fire blanket",
        "Foam extinguisher",
        "A wet cloth over the top",
      ],
      correct: [1],
      why: "Wet chemical is designed for cooking fat — it forms a soapy crust that smothers and cools it. A fire blanket also works on a small pan fire. Foam is for flammable liquids, not deep-fat fryers.",
    },
    {
      id: "f-water-on-fat",
      kind: "single",
      prompt: "Why must you never put water on burning cooking oil?",
      options: [
        "It leaves a residue that ruins the oil",
        "It flashes to steam instantly and throws burning oil across the kitchen",
        "It cools the oil too quickly and cracks the pan",
        "It works, but it is against food safety rules",
      ],
      correct: [1],
      why: "Water hitting oil at frying temperature turns to steam in an instant and erupts, spraying burning fat over everything nearby — including whoever is holding the extinguisher.",
    },
    {
      id: "f-co2",
      kind: "single",
      prompt: "There is a fire in an electrical distribution board. Which extinguisher is appropriate?",
      options: ["Water", "CO2", "Wet chemical", "Water additive"],
      correct: [1],
      why: "CO2 leaves no residue and does not conduct, which is why it is the electrical extinguisher. It does not cool the fuel, so the fire can reignite — and the horn gets cold enough to injure your hand.",
    },
    {
      id: "f-powder",
      kind: "single",
      prompt: "Why is dry powder generally the wrong choice inside a working kitchen?",
      options: [
        "It does not work on cooking oil",
        "It destroys visibility in seconds, including your view of the exit, and contaminates food areas",
        "It is only for use by the fire service",
        "It is too heavy to lift safely",
      ],
      correct: [1],
      why: "Powder works on a lot of fires but discharging it in an enclosed room blinds you and coats every surface. It is generally an outdoor extinguisher.",
    },
    {
      id: "f-guest-belongings",
      kind: "single",
      prompt: "The alarm sounds mid-service. A guest wants to go back to the table for their coat and to settle the bill. What do you say?",
      options: [
        "Let them — it takes ten seconds",
        "Leave now, we will sort the bill and belongings at the assembly point",
        "Tell them to be quick and meet you outside",
        "Take payment first so the till balances",
      ],
      correct: [1],
      why: "Nobody goes back for belongings or to pay. Politely and without negotiating — out now, sorted outside.",
    },
    {
      id: "f-doors",
      kind: "multi",
      prompt: "Which of these statements about fire doors are correct?",
      note: "Select all that apply.",
      options: [
        "Wedging one open is acceptable as long as somebody is working in the room",
        "They stop smoke and fire spreading and buy people time to get out",
        "Closing doors behind you as you evacuate slows the fire down",
        "A propped fire door is one of the most common serious fire safety failures in hospitality",
      ],
      correct: [1, 2, 3],
      why: "A fire door only works closed. There is no version of wedging one open that is acceptable, however hot the kitchen gets.",
    },
    {
      id: "f-unattended",
      kind: "single",
      prompt: "What is the leading cause of fires in food-service premises?",
      options: [
        "Electrical faults in old wiring",
        "Cooking — mostly unattended cooking and hot oil",
        "Smoking materials",
        "Arson",
      ],
      correct: [1],
      why: "Cooking is the leading cause almost everywhere it is measured, and unattended hot oil is the biggest part of it. That is why the pan rule is absolute.",
    },
    {
      id: "f-attempt",
      kind: "multi",
      prompt: "Before you attempt to use an extinguisher, which of these must be true?",
      note: "Select all that apply.",
      options: [
        "The alarm has already been raised",
        "The fire is small and not spreading",
        "Your escape route is behind you",
        "You should keep trying until the extinguisher is empty",
      ],
      correct: [0, 1, 2],
      why: "One attempt only. If it does not go out, put the extinguisher down and leave — do not empty it into a fire that is winning.",
    },
    {
      id: "f-rollcall",
      kind: "single",
      prompt: "At the assembly point, how do you establish who is unaccounted for?",
      options: [
        "Wait for people to report themselves missing",
        "Roll call from the clock-in list and the rota, plus a headcount of guests",
        "Assume everybody heard the alarm and left",
        "Send somebody back in to check the building",
      ],
      correct: [1],
      why: "The clock-in list and rota tell you who was in the building. That information is only useful in the first few minutes, so report anybody missing to the fire service as soon as they arrive.",
    },
    {
      id: "f-reentry",
      kind: "single",
      prompt: "The fire looks like it has gone out and your phone is still on the bar. What do you do?",
      options: [
        "Go in quickly while it is safe",
        "Stay out until the fire service says the building is safe",
        "Send the newest member of staff, they are quickest",
        "Go in if a manager says it is fine",
      ],
      correct: [1],
      why: "Nobody re-enters for any reason until the fire service says so. A fire that looks out can still be burning inside a ceiling void or reignite.",
    },
    {
      id: "f-grease",
      kind: "single",
      prompt: "Why does grease build-up in the extraction canopy and ducting matter so much?",
      options: [
        "It smells and affects the food",
        "It is a continuous fuel path running through the ceiling void, which is how a kitchen fire becomes a building fire",
        "It reduces the extraction fan's efficiency and costs money",
        "It only matters for the annual inspection",
      ],
      correct: [1],
      why: "Grease inside ductwork is a fuse. Filters daily, and full duct cleaning by a competent contractor at whatever interval the risk assessment sets.",
    },
    {
      id: "f-electrical",
      kind: "multi",
      prompt: "Which of these should be reported the same shift rather than left?",
      note: "Select all that apply.",
      options: [
        "A plug that is warm to the touch",
        "A flex with the braid or copper showing",
        "A scorch mark around a socket",
        "A fryer whose thermostat seems to overshoot",
      ],
      correct: [0, 1, 2, 3],
      why: "All four are ignition sources waiting for the right night. None of them fix themselves, and all of them are cheap to fix before rather than after.",
    },
    {
      id: "f-gas",
      kind: "single",
      prompt: "Should you isolate the gas before evacuating?",
      options: [
        "Always, whatever it takes to reach the valve",
        "Only if the valve is on your way out and it is safe to do so",
        "Never — leave it for the fire service",
        "Only if a manager instructs you to",
      ],
      correct: [1],
      why: "Isolate if it is safe and on your way out. Never go further into the building, or back into it, to switch something off.",
    },
    {
      id: "f-smoke",
      kind: "single",
      prompt: "What is the main thing that kills people in building fires?",
      options: ["Flames", "Smoke and toxic gases", "Structural collapse", "Panic in the crowd"],
      correct: [1],
      why: "Smoke, not flame. Fat-laden kitchen smoke incapacitates in a few breaths, which is why the whole procedure is built on getting out early rather than fighting it.",
    },
    {
      id: "f-clothing",
      kind: "single",
      prompt: "A member of staff's chef whites catch fire at the range. What is the right response?",
      options: [
        "Get them under the pot wash tap",
        "Smother the flames with a fire blanket and get them to the floor",
        "Use the CO2 extinguisher on them",
        "Use the dry powder extinguisher on them",
      ],
      correct: [1],
      why: "A fire blanket is what goes over a person. Extinguishers are not designed to be discharged onto someone — CO2 in particular causes cold injury.",
    },
    {
      id: "f-newstarter",
      kind: "single",
      prompt: "An agency bartender starts on a Friday night with no induction booked until the following week. What has to happen before service?",
      options: [
        "Nothing — they are agency, their own employer covers it",
        "Show them the exits, the assembly point and the alarm call points",
        "Give them the fire risk assessment to read after service",
        "Pair them with somebody and hope for the best",
      ],
      correct: [1],
      why: "Anybody on the floor needs to know the exits, the assembly point and the call points before their first service. Turnover and agency cover is the gap that catches hospitality specifically.",
    },
    {
      id: "f-exit-blocked",
      kind: "single",
      prompt: "A delivery has been left stacked in the corridor that leads to the fire exit. What is it?",
      options: [
        "Untidy, and it can wait until after service",
        "A blocked escape route — move it now and say so",
        "Fine as long as the door itself still opens",
        "Only a problem if the corridor is the main exit",
      ],
      correct: [1],
      why: "An escape route has to be clear and usable, not technically passable. Stock in a corridor is the classic finding, and the classic reason an evacuation goes wrong.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Questions built from the venue's own register
// --------------------------------------------------------------------------- //

export function fireAssetQuestions(assets: CourseAsset[], seed: number): QuizQuestion[] {
  const live = assets.filter((a) => a.status !== "retired");
  const risky = live.filter((a) => a.fireRisk);
  const out: QuizQuestion[] = [];

  if (live.length === 0) {
    // Nothing recorded — test the instinct instead of the list, the same way the
    // allergen course does with an unconfirmed dish.
    out.push({
      id: "a-empty",
      kind: "single",
      prompt:
        "Your equipment register has nothing recorded in it. What does that tell you about the fire risk in the building?",
      options: [
        "There is nothing significant to worry about",
        "Nothing — an empty register only means nobody has written the equipment down yet",
        "The risk assessment must have found no hazards",
        "It means the equipment is all new and under warranty",
      ],
      correct: [1],
      why: "A blank record is never evidence of an absence. It means the walk has not been done and written up.",
    });
    return out;
  }

  // 1. Which of our own items carry a fire risk? Real names, real decoys.
  if (risky.length > 0 && live.length > risky.length) {
    const decoys = live.filter((a) => !a.fireRisk);
    const chosenRisky = shuffled(risky, seed).slice(0, 3);
    const chosenDecoys = shuffled(decoys, seed + 5).slice(0, Math.max(1, 5 - chosenRisky.length));
    const optionAssets = shuffled([...chosenRisky, ...chosenDecoys], seed + 11);
    out.push({
      id: "a-risky",
      kind: "multi",
      prompt:
        "Which of these items from your own equipment register carry a real fire risk — cooking, extraction or electrical?",
      note: "Select all that apply. These are the venue's own recorded assets.",
      options: optionAssets.map((a) => label(a)),
      correct: optionAssets
        .map((a, i) => (a.fireRisk ? i : -1))
        .filter((i) => i >= 0),
      why: `Cooking equipment, extraction and electrical plant are the fire-risk categories. ${
        chosenDecoys.length === 1
          ? `${chosenDecoys[0].name} is not one of them`
          : `${chosenDecoys.map((d) => d.name).join(" and ")} are not`
      } — though a faulty motor or plug on anything electrical still gets reported.`,
    });
  }

  // 2. A named fryer, with the extinguisher question tied to their own kit.
  const fryer = shuffled(risky.filter((a) => a.fryer), seed + 3)[0];
  if (fryer) {
    out.push({
      id: `a-fryer-${fryer.id}`,
      kind: "single",
      prompt: `The oil in "${fryer.name}"${
        fryer.location ? ` in ${fryer.location}` : ""
      } catches fire. What is the correct response?`,
      note: "This is a piece of equipment recorded on your own register.",
      options: [
        "Water extinguisher, aimed at the base of the flames",
        "Raise the alarm, then smother it with wet chemical (Class F) or a fire blanket if it is small and your exit is behind you",
        "Carry it outside to the yard",
        "Foam extinguisher, then turn the extraction up to clear the smoke",
      ],
      correct: [1],
      why: "Alarm first, then wet chemical or a blanket. Never water on fat, never move a burning pan or fryer, and turning up the extraction pulls fire into greasy ducting.",
    });
  }

  // 3. An overdue service on something that can burn.
  const late = shuffled(risky.filter((a) => a.serviceOverdue), seed + 7)[0];
  if (late) {
    out.push({
      id: `a-overdue-${late.id}`,
      kind: "single",
      prompt: `Your register shows "${late.name}" was due a service on ${niceDate(
        late.nextServiceDate
      )}, which has passed. Why does that matter for fire safety?`,
      note: "This is your own recorded service date.",
      options: [
        "It does not — it only affects the warranty",
        "Unserviced cooking, gas or extraction equipment is a genuine ignition risk, so it gets reported and booked",
        "It matters only if the equipment stops working",
        "It matters only at the annual inspection",
      ],
      correct: [1],
      why: "A thermostat that overshoots or an extraction run nobody has cleaned is exactly how these fires start. An overdue service on this kind of kit is a fire issue, not an admin one.",
    });
  }

  // 4. Somewhere in the building — location recall, which is what actually
  //    matters at 9pm when the room is filling with smoke.
  const located = shuffled(live.filter((a) => a.location && a.fireRisk), seed + 13)[0];
  if (located) {
    out.push({
      id: `a-location-${located.id}`,
      kind: "single",
      prompt: `"${located.name}" is recorded in ${located.location}. What should everybody on shift know about that area?`,
      note: "Recorded location from your own register.",
      options: [
        "Nothing in particular — it is only a location field",
        "Where its isolation switch or valve is, the nearest alarm call point, and the nearest appropriate extinguisher",
        "Only the manager needs to know that",
        "Just to keep the door to it closed",
      ],
      correct: [1],
      why: "Fire-risk equipment means knowing the isolation point, the nearest call point and the right extinguisher for it — before you need them, not while looking for them.",
    });
  }

  return out;
}

/** The full fire paper: the venue's own equipment first, topped up with knowledge. */
export function fireQuiz(assets: CourseAsset[], seed: number): QuizQuestion[] {
  const fromAssets = fireAssetQuestions(assets, seed);
  const wanted = 12;
  const knowledge = shuffled(fireBank(), seed).slice(
    0,
    Math.max(8, wanted - fromAssets.length)
  );
  return shuffled([...fromAssets, ...knowledge], seed + 31);
}
