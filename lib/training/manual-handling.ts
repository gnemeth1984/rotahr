/**
 * Manual handling awareness — in-house course content.
 *
 * ── What this is ────────────────────────────────────────────────────────────
 * Employer-delivered awareness training on lifting, carrying, pushing and
 * pulling in a hospitality building, built around the venue's own stock list so
 * the heavy things it names are the heavy things they actually take in.
 *
 * ── What it is NOT ──────────────────────────────────────────────────────────
 * It is NOT the accredited, instructor-led manual handling course. That one is
 * hands-on by design: somebody has to watch a person lift and correct them, and
 * no web page can do that. In several countries an accredited course with
 * practical assessment is what an operator is actually expected to provide, and
 * it is usually valid for a fixed period. This course does not replace it and
 * must never be presented as if it does. Treat it as the instruction that keeps
 * the knowledge alive between the real ones.
 *
 * ── On the numbers ──────────────────────────────────────────────────────────
 * Guideline lifting weights are exactly that — guidelines, not legal limits —
 * and they differ by country. Published guidance charts commonly put a
 * two-handed lift held close to the body at knuckle height at around 25 kg for
 * men and 16 kg for women, and every one of those charts cuts the figure hard
 * for a lift at floor level, above shoulder height, or held away from the body.
 * Every figure in this course is stated as a common guideline with a nudge to
 * check local rules, exactly like lib/templates/types.ts requires.
 */

import {
  type CourseStock,
  type Lesson,
  type QuizQuestion,
  shuffled,
  stockWeight,
} from "./kit";

// --------------------------------------------------------------------------- //
// The venue-data lesson
// --------------------------------------------------------------------------- //

function withWeight(item: CourseStock): string {
  const w = stockWeight(item);
  if (item.keg && !w) return `${item.name} — a keg`;
  if (item.keg && w) return `${item.name} — ${w} keg`;
  return w ? `${item.name} — ${w} recorded` : item.name;
}

/** Heaviest first, so the lesson leads with the worst of it. */
function byWeightDesc(a: CourseStock, b: CourseStock): number {
  const av = a.kg ?? a.litres ?? (a.keg ? 50 : 0);
  const bv = b.kg ?? b.litres ?? (b.keg ? 50 : 0);
  return bv - av;
}

function stockLesson(items: CourseStock[]): Lesson {
  const heavy = [...items.filter((i) => i.heavy)].sort(byWeightDesc);
  const kegs = heavy.filter((i) => i.keg);
  const weighed = items.filter((i) => i.kg !== null || i.litres !== null);

  if (heavy.length === 0) {
    const someRecorded = items.length > 0;
    const noFigures = someRecorded && weighed.length === 0;
    return {
      id: "your-deliveries",
      title: "What you actually lift here",
      body: [
        someRecorded
          ? noFigures
            ? `This lesson normally names the heaviest things on your own stock list. Your list has ${items.length} ${
                items.length === 1 ? "item" : "items"
              } on it, but no pack weights recorded against any of them, so there is no figure to show you.`
            : `This lesson normally names the heaviest things on your own stock list. Nothing on your list is recorded at ${10} kg or more, so there is nothing here to single out.`
          : "This lesson normally names the heaviest things on your own stock list — the sacks, the oil, the kegs. Nothing is recorded yet, so there is nothing to show.",
        someRecorded
          ? "That is not the same as saying the deliveries are light. A recorded weight is only there if somebody typed the pack size in, and the pack size is not what does the damage anyway — a 6 kg box carried at arm's length down a cellar stair is worse than 20 kg held against your chest on the flat."
          : "A manager can build the stock list under Stock. It is worth doing for ordering and food cost on its own, and pack sizes typed in there are what let this lesson name real figures instead of talking in general terms.",
        "So do it by hand. Before the next delivery, walk the route from where the van stops to where the goods end up. Count the steps, the doors, the thresholds, the cellar hatch. That walk is the lift.",
      ],
      keyPoint:
        "No recorded weight is not the same as no weight. If you cannot tell what is in a box, treat it as heavy until you have tried the corner of it.",
    };
  }

  const named = heavy.slice(0, 8).map(withWeight);
  const body = [
    "This is the part no outside training provider can give you: the heaviest things recorded on your own stock list, by name.",
    `Your list has ${heavy.length} ${
      heavy.length === 1 ? "item" : "items"
    } that count as a load rather than a box — 10 kg or more, or a keg. These are the ones worth deciding about before you touch them, not while you are holding them.`,
  ];

  if (kegs.length > 0) {
    body.push(
      `${
        kegs.length === 1 ? "One of them is a keg" : `${kegs.length} of them are kegs`
      }. A 50 litre keg is roughly 60 kg full and it is the single most dangerous thing most bars move by hand — heavy, round, no handles, and usually going down a stair or through a hatch. Kegs get a wheel, a trolley, a drop mat or two people. They never get carried down steps.`
    );
  }

  if (weighed.length < items.length) {
    body.push(
      `Worth knowing: ${items.length - weighed.length} of the ${items.length} items on your list have no pack weight recorded at all, so this list is the ones we can prove, not necessarily the worst ones. Treat anything unlabelled as heavy until you have tested the corner of it.`
    );
  }

  return {
    id: "your-deliveries",
    title: "What you actually lift here",
    body,
    bullets: named,
    keyPoint:
      "Deciding how to move something is a two-second job before the lift and an impossible one halfway through it. Look at the weight, look at the route, then pick it up.",
  };
}

// --------------------------------------------------------------------------- //
// Lessons
// --------------------------------------------------------------------------- //

export function manualHandlingLessons(items: CourseStock[]): Lesson[] {
  return [
    {
      id: "why",
      title: "Why this matters",
      body: [
        "Back and shoulder injuries are one of the most common reasons hospitality staff end up off work, and they almost never happen the way people imagine. Hardly anybody is hurt lifting one heroic weight. They are hurt by the four hundredth keg, the fiftieth dishwasher rack, the tray held out at arm's length twice a shift for eleven years. The damage is cumulative, and it is silent right up until it is not.",
        "The second thing worth knowing is that this kind of injury does not heal like a cut. A badly damaged back can follow somebody for the rest of their working life and quietly end a kitchen career at forty. That is the actual stake here — not the paperwork.",
        "Operators are generally expected to avoid hazardous manual handling where it is reasonably practicable, assess what cannot be avoided, and reduce the risk. The detail differs by country, and the accredited hands-on course is usually part of it. This course is the awareness half — the part you can keep fresh between the real ones.",
      ],
      keyPoint:
        "The lift that injures you will feel like every other lift you have done. That is exactly why the technique has to be the boring default and not something you save for the heavy ones.",
    },
    {
      id: "assess",
      title: "Think before you touch it",
      body: [
        "Every published system for this says the same thing in different words: look at the job, the person, the load and the place before you lift. It takes two seconds and it is the whole course.",
        "Most injuries in a venue are not a technique failure. They are a decision failure — somebody decided to carry it in one go because the trolley was upstairs, or because the delivery driver was waiting, or because asking for help felt like admitting something.",
      ],
      bullets: [
        "The task — how far, how many times, up or down, any twisting, any holding it still at the end.",
        "The individual — you. Your own strength, height, any injury you already have, whether you are pregnant, whether you are new and have not done this before.",
        "The load — weight, shape, whether it has handles, whether the contents move, whether it is hot, wet or sharp.",
        "The environment — floor surface, wet patches, steps, thresholds, cellar hatches, doors that swing back, lighting, how cold it is in the walk-in.",
      ],
      keyPoint:
        "If the answer to \"can I carry this?\" is \"probably\", the answer is no. Split it, wheel it, or get a second person.",
    },
    {
      id: "technique",
      title: "The lift itself",
      body: [
        "There is no magic posture. There is a sequence that keeps the load close and your spine stacked, and it works because the further a weight sits from your spine the more the muscles either side of it have to fight, several times over.",
        "Read this once properly and then use it on light things too. Technique you only use on heavy items is technique you do not have.",
      ],
      bullets: [
        "Stand close, feet apart, one foot slightly forward for balance.",
        "Bend the knees and hips, not the back. Keep the natural curve in your lower back and your chin tucked in.",
        "Get a firm grip — hook your fingers under a corner rather than pinching an edge. Test the weight before you commit.",
        "Lift smoothly with the legs. No jerk, no snatch, no holding your breath and heaving.",
        "Keep the load against your body, between knuckle and elbow height where you can.",
        "To change direction, move your feet. Never twist your spine under load.",
        "Put it down the same way you picked it up, then slide it into position — do not set it down at full stretch.",
      ],
      keyPoint:
        "Twisting while loaded is the classic hospitality injury: lift the case, turn to the shelf, done. Move the feet instead, every time.",
    },
    stockLesson(items),
    {
      id: "kit-and-team",
      title: "Kit, teams and the things that beat muscle",
      body: [
        "The best manual handling is the lift that does not happen. A sack trolley, a keg wheel, a pallet truck, a drop mat, a decant into two smaller containers, a shelf at waist height instead of at the floor — every one of those removes risk rather than managing it.",
        "Team lifts work when one person runs them and fail when nobody does. Agree who calls it, agree the route and where it lands, and lift on a spoken count. Uneven lifting between two people is worse than either of them doing it alone.",
        "There is also a fair bit a venue can fix once and never think about again: heavy stock stored between knee and shoulder height, light stuff up top, the delivery drop point closer to the store, a trolley that actually lives where the deliveries land.",
      ],
      keyPoint:
        "\"The trolley was in the way / upstairs / had a flat wheel\" is behind a lot of injuries. If the kit is not where it needs to be, that is a fault to report, not an excuse to lift.",
    },
    {
      id: "venue-hazards",
      title: "The specific ways a venue hurts people",
      body: [
        "Hospitality has its own list, and none of it is on a generic lifting poster.",
      ],
      bullets: [
        "Cellar drops and hatches — never stand below a load, never break a keg's fall with any part of your body, never carry a keg down steps.",
        "Stairs — one hand free, a clear view of your feet, and never a load you cannot see over.",
        "Walk-ins and freezers — cold muscles strain more easily, the floor is often slick, and boxes freeze to shelves and then come away suddenly.",
        "Hot liquid — a full stockpot moved across a kitchen is a burn waiting to happen. Decant it, or use two people and announce that you are coming through.",
        "Plates and glassware — stacking up the forearm is how people wreck a wrist or a shoulder over years. Use a tray or make two trips.",
        "Bin runs, keg returns and stacked crates — repetitive, unglamorous, and where most of the real damage accumulates.",
        "Awkward, not heavy — a table, a flat pack, a mirror, a bar stool. Weight is not the only thing that injures you.",
      ],
      keyPoint:
        "Anything above shoulder height gets a step or a platform. Not a chair, not a crate, not the bottom shelf of a shelving unit.",
    },
    {
      id: "speak-up",
      title: "Reporting, and asking for the task to change",
      body: [
        "Report a strain, a twinge or a near miss the same shift it happens. Not on your next day off, not when it gets worse. Early reporting is the single biggest difference between a week of light duties and a chronic back.",
        "Some things mean the task should change rather than the person toughening up: pregnancy or a recent birth, an existing back, shoulder or hernia problem, a new starter who has never moved a keg, a young worker, somebody working alone. Telling a manager is not a weakness and it is not a resignation — it is how the job gets adjusted before something happens.",
        "The same goes for the near miss nobody was hurt by. A keg that got away on the cellar steps and hit nothing is the free warning before the one that does not miss.",
      ],
      keyPoint:
        "Nobody has ever been sacked for asking for a second pair of hands. Plenty of people are still in pain from not asking.",
    },
    {
      id: "records",
      title: "What the venue should be able to show",
      body: [
        "An inspector or an insurer asking about manual handling is generally asking to see four things: that the hazardous handling was looked at, that what could not be avoided was assessed, that the risk was reduced with kit or layout or team lifts, and that the people doing it were trained.",
        "The record of this course goes on your training file with the date and expiry. Keep the accredited, hands-on course alongside it where your local rules expect one — this is instruction, not a substitute for practical assessment.",
      ],
      bullets: [
        "A manual handling risk assessment for the real tasks — deliveries, cellar work, bin runs, section setup.",
        "Training records with dates, including new starters and agency staff before their first delivery.",
        "Handling kit that exists, works, and is where the work is.",
        "An accident and near-miss log that people actually fill in.",
      ],
      keyPoint:
        "A new starter's first delivery is their highest-risk lift of the year. Brief them before it lands, not after.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Knowledge questions
// --------------------------------------------------------------------------- //

export function manualHandlingBank(): QuizQuestion[] {
  return [
    {
      id: "m-first-step",
      kind: "single",
      prompt: "A delivery lands and there is a heavy sack on the floor to move. What comes first?",
      options: [
        "Look at the load, the route and whether you need help or kit",
        "Get it up quickly before the driver leaves",
        "Take a deep breath and lift with your back straight",
        "Ask someone else to do it",
      ],
      correct: [0],
      why: "The decision is the safety step. Once you are holding it, your options are gone.",
    },
    {
      id: "m-technique",
      kind: "multi",
      prompt: "Which of these belong in a safe lift?",
      options: [
        "Bend the knees and hips, keeping the natural curve in your lower back",
        "Keep the load close to your body",
        "Lift smoothly, without jerking",
        "Straighten your legs fast to get the momentum going",
        "Keep your chin tucked in rather than throwing your head back",
      ],
      correct: [0, 1, 2, 4],
      why: "Smooth and close is the whole idea. Momentum is what turns a lift into an injury.",
    },
    {
      id: "m-twist",
      kind: "single",
      prompt: "You have lifted a case and need to turn ninety degrees to put it on a shelf. What do you do?",
      options: [
        "Move your feet to turn your whole body",
        "Twist at the waist — it is only a short turn",
        "Turn your shoulders and keep the hips still",
        "Swing it round using the momentum",
      ],
      correct: [0],
      why: "Twisting under load is one of the most common ways a back goes. Feet, not spine.",
    },
    {
      id: "m-close",
      kind: "single",
      prompt: "Why does holding a load away from your body matter so much?",
      options: [
        "The strain on your back multiplies the further the weight sits from your spine",
        "It does not matter as long as the weight is under the guideline",
        "It only matters if the load is over 25 kg",
        "It makes the load feel heavier but does no extra harm",
      ],
      correct: [0],
      why: "Distance is a multiplier. The same box at arm's length can be several times the load on your spine.",
    },
    {
      id: "m-limits",
      kind: "single",
      prompt: "What is the legal maximum weight one person is allowed to lift?",
      options: [
        "There generally is no fixed legal limit — published figures are guidelines that drop sharply for awkward lifts",
        "25 kg for everyone",
        "16 kg for everyone",
        "50 kg if you use the correct technique",
      ],
      correct: [0],
      why: "Guidance charts give indicative figures — commonly around 25 kg for men and 16 kg for women close to the body at knuckle height — and cut them hard for lifts at floor level, above the shoulder, or held away from the body. They are not permits. Check the rules where you work.",
    },
    {
      id: "m-doubt",
      kind: "single",
      prompt: "You test the corner of a box and you are honestly not sure you can carry it to the store in one go. What is the right call?",
      options: [
        "Split it, wheel it, or get a second person",
        "Carry it but go quickly so it is over sooner",
        "Carry it and rest halfway by holding it against a wall",
        "Drag it along the floor with both hands behind you",
      ],
      correct: [0],
      why: "\"Probably\" means no. Every alternative here is cheaper than a back injury.",
    },
    {
      id: "m-team",
      kind: "single",
      prompt: "Two of you are lifting a table together. What makes it safe?",
      options: [
        "One person calls the lift, the route and where it lands, and you move on a spoken count",
        "Both of you lift when you feel ready",
        "The stronger person takes the heavier end and sets the pace silently",
        "The taller person walks backwards so they can steer",
      ],
      correct: [0],
      why: "Uneven, unspoken team lifts are worse than lifting alone. Somebody has to run it out loud.",
    },
    {
      id: "m-route",
      kind: "multi",
      prompt: "What are you checking on the route before you carry something heavy along it?",
      options: [
        "Wet or greasy patches on the floor",
        "Steps, thresholds and the cellar hatch",
        "Doors that swing back or need a hand to open",
        "Whether anything is stored in the way",
        "Whether the lighting is good enough to see your feet",
      ],
      correct: [0, 1, 2, 3, 4],
      why: "The route is part of the lift. Almost every one of these has put somebody on the floor in a hospitality building.",
    },
    {
      id: "m-keg",
      kind: "multi",
      prompt: "Moving a full 50 litre keg — which of these are right?",
      options: [
        "Use a keg wheel, trolley, drop mat or two people",
        "Never carry it down steps",
        "Never stand below a keg being lowered",
        "Roll it on its edge down the cellar stairs, controlled by hand",
        "Bear-hug it and walk it down slowly",
      ],
      correct: [0, 1, 2],
      why: "A full 50 L keg is roughly 60 kg with no handles. Controlling one on stairs by hand is how people are crushed.",
    },
    {
      id: "m-stairs",
      kind: "single",
      prompt: "You have to take a load down a flight of stairs. What is the rule?",
      options: [
        "Keep one hand free, keep your feet in view, and never take a load you cannot see over",
        "Go quickly so you spend less time on the stairs",
        "Hold it out in front so it does not hit your knees",
        "Take the biggest load you can manage so you make fewer trips",
      ],
      correct: [0],
      why: "Stairs remove your recovery options. Vision and a free hand are what keep a stumble from being a fall.",
    },
    {
      id: "m-overhead",
      kind: "single",
      prompt: "Something needs to come down from a shelf above shoulder height. What do you use?",
      options: [
        "A step or a platform, and split the load if you can",
        "A chair from the dining room",
        "An upturned crate",
        "The lower shelves of the shelving unit as steps",
      ],
      correct: [0],
      why: "Above the shoulder your strength and balance both drop. Improvised steps are how the fall happens.",
    },
    {
      id: "m-push",
      kind: "single",
      prompt: "You have a loaded trolley to move across the yard. Push or pull?",
      options: [
        "Push where you can — it puts less strain on your back and you can see where you are going",
        "Pull — you have more grip strength that way",
        "It makes no difference to your back",
        "Pull on flat ground and push up slopes",
      ],
      correct: [0],
      why: "Pushing lets you use your body weight and keeps your spine in a better position. Handles between waist and shoulder height are ideal.",
    },
    {
      id: "m-hot",
      kind: "single",
      prompt: "A full stockpot of hot liquid needs to move from the range to the sink.",
      options: [
        "Decant it, or use two people and call out that you are coming through",
        "Carry it quickly with a dry cloth in each hand",
        "Carry it at arm's length so it is away from your body",
        "Let it cool for five minutes and then carry it alone",
      ],
      correct: [0],
      why: "Weight plus scald plus a busy walkway. Announce it or do not move it.",
    },
    {
      id: "m-plates",
      kind: "single",
      prompt: "What is wrong with stacking plates up your forearm?",
      options: [
        "It loads the wrist and shoulder in a bad position over and over, and the damage builds up",
        "Nothing, as long as you can hold them",
        "Only the risk of dropping them",
        "It is fine if you keep your back straight",
      ],
      correct: [0],
      why: "This is a cumulative injury, not an accident. Trays exist for a reason.",
    },
    {
      id: "m-cumulative",
      kind: "single",
      prompt: "Which is more likely to cause a lasting back or shoulder injury in a venue?",
      options: [
        "Repeating a moderate lift many times a shift, for years",
        "One very heavy lift done badly",
        "Neither — backs only go from accidents",
        "Only lifts above the guideline weight",
      ],
      correct: [0],
      why: "Repetition does most of the damage in hospitality. That is why technique has to be the default rather than the exception.",
    },
    {
      id: "m-declare",
      kind: "multi",
      prompt: "Which of these should a member of staff tell a manager about, so the task can be changed?",
      options: [
        "They are pregnant or have recently given birth",
        "They have an existing back, shoulder or hernia problem",
        "They are a new starter who has never moved a keg",
        "They are working alone on a delivery",
        "They pulled something last night and it still hurts",
      ],
      correct: [0, 1, 2, 3, 4],
      why: "All five change the risk. The task gets adjusted — that is the whole point of saying it.",
    },
    {
      id: "m-report",
      kind: "single",
      prompt: "You feel a sharp twinge in your lower back lifting a box mid-service. What do you do?",
      options: [
        "Tell a manager this shift and get it recorded",
        "Finish the week and see if it settles",
        "Say nothing — it will only cause hassle with the rota",
        "Take painkillers and keep going, then mention it at your next review",
      ],
      correct: [0],
      why: "Early reporting is the difference between light duties for a week and a problem you keep for years. It also has to be in the accident log.",
    },
    {
      id: "m-nearmiss",
      kind: "single",
      prompt: "A keg got away from someone on the cellar steps and hit nothing. Nobody was hurt.",
      options: [
        "Report it — a near miss is the free warning before the one that lands",
        "No need, since there was no injury",
        "Mention it only if it happens again",
        "Report it only if the keg was damaged",
      ],
      correct: [0],
      why: "Near misses are the cheapest information a venue ever gets about its own risks.",
    },
    {
      id: "m-newstarter",
      kind: "single",
      prompt: "When should a new starter be briefed on handling deliveries and kegs?",
      options: [
        "Before their first delivery",
        "In their first month",
        "At their probation review",
        "Only if they will be working in the cellar regularly",
      ],
      correct: [0],
      why: "Their first delivery is their highest-risk lift. Agency staff and casual cover get the same brief.",
    },
    {
      id: "m-storage",
      kind: "multi",
      prompt: "Which of these fix the risk once, rather than managing it every time?",
      options: [
        "Storing the heaviest stock between knee and shoulder height",
        "Keeping a trolley where the deliveries actually land",
        "Getting bulky items delivered in smaller pack sizes",
        "Reminding staff to be careful at the pre-shift briefing",
        "Moving the drop point closer to the store",
      ],
      correct: [0, 1, 2, 4],
      why: "Layout, kit and pack size remove the hazard. \"Be careful\" leaves it exactly where it was.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Questions from the venue's own stock list
// --------------------------------------------------------------------------- //

export function stockQuestions(items: CourseStock[], seed: number): QuizQuestion[] {
  const heavy = [...items.filter((i) => i.heavy)].sort(byWeightDesc);
  const light = items.filter((i) => !i.heavy);

  if (items.length === 0) {
    return [
      {
        id: "s-empty",
        kind: "single",
        prompt:
          "Your stock list has nothing recorded in it. What does that tell you about the heavy lifting in this building?",
        options: [
          "Nothing — an empty stock list only means nobody has written the deliveries down yet",
          "There is nothing heavy coming in",
          "The deliveries must all be within the guideline weights",
          "It means somebody else is handling the deliveries",
        ],
        correct: [0],
        why: "A blank record is not a confirmed absence. Until it is filled in, treat every unlabelled box as heavy until you have tested the corner of it.",
      },
    ];
  }

  const out: QuizQuestion[] = [];

  // Which of their own items are actually loads. Only worth asking when there is
  // something real on both sides of the line.
  if (heavy.length > 0 && light.length > 0) {
    const picks = [
      ...shuffled(heavy, seed).slice(0, 3),
      ...shuffled(light, seed + 5).slice(0, 3),
    ];
    const options = shuffled(picks, seed + 9);
    out.push({
      id: "s-heavy",
      kind: "multi",
      prompt:
        "Which of these items from your own stock list are recorded heavily enough to plan the lift — 10 kg or more, or a keg?",
      note: "Pack weights as recorded on your stock list.",
      options: options.map(withWeight),
      correct: options.map((o, i) => (o.heavy ? i : -1)).filter((i) => i >= 0),
      why: "These are the ones that get a trolley, a team lift or a decant decided before you touch them.",
    });
  }

  const keg = heavy.find((i) => i.keg);
  if (keg) {
    out.push({
      id: `s-keg-${keg.id}`,
      kind: "single",
      prompt: `Your stock list includes ${keg.name}. It has to go from the delivery point down to the cellar.`,
      options: [
        "Use the keg wheel, trolley or drop mat, with a second person, and never carry it down the steps",
        "Two people carry it down the steps together, one at each end",
        "Roll it down the steps slowly, controlled by hand",
        "Bear-hug it and take the steps one at a time",
      ],
      correct: [0],
      why: "A full 50 L keg is roughly 60 kg with nothing to hold. Nobody's grip is the last line of defence on a cellar stair.",
    });
  }

  const heaviest = heavy.find((i) => !i.keg && (i.kg !== null || i.litres !== null));
  if (heaviest) {
    const w = stockWeight(heaviest);
    out.push({
      id: `s-move-${heaviest.id}`,
      kind: "single",
      prompt: `Your stock list records ${heaviest.name} at ${w}. Six of them have just landed at the door and they need to go to the store at the far end of the building.`,
      options: [
        "Use a trolley, or take them one at a time held close to your body",
        "Carry two at a time to halve the number of trips",
        "Stack all six and carry them in one go, keeping your back straight",
        "Drag them along the floor to avoid lifting at all",
      ],
      correct: [0],
      why: `${w} each, carried repeatedly across a building, is exactly the cumulative load that does the damage. Kit first, then one at a time close to the body.`,
    });
  }

  // A list with items but no recorded weights is its own lesson.
  if (heavy.length === 0) {
    const weighed = items.filter((i) => i.kg !== null || i.litres !== null);
    out.push({
      id: "s-noweights",
      kind: "single",
      prompt:
        weighed.length === 0
          ? "Your stock list has items on it but no pack weights recorded against any of them. What should you do with an unlabelled delivery box?"
          : "Nothing on your stock list is recorded at 10 kg or more. What should you do with a delivery box you cannot identify?",
      options: [
        "Treat it as heavy until you have tested the corner of it",
        "Assume it is light, since nothing heavy is recorded",
        "Lift it quickly and see how it feels",
        "Wait for a manager to tell you what is in it",
      ],
      correct: [0],
      why: "A missing figure is a missing figure, not a light box. Test the corner before you commit to the lift.",
    });
  }

  return out;
}

// --------------------------------------------------------------------------- //
// The paper
// --------------------------------------------------------------------------- //

export function manualHandlingQuiz(items: CourseStock[], seed: number): QuizQuestion[] {
  const fromStock = stockQuestions(items, seed);
  const wanted = 12;
  const knowledge = shuffled(manualHandlingBank(), seed).slice(
    0,
    Math.max(8, wanted - fromStock.length)
  );
  return shuffled([...fromStock, ...knowledge], seed + 31);
}
