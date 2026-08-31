/**
 * Front-of-house allergen service — in-house course content.
 *
 * Same rules as every other course in this folder: employer-delivered awareness
 * training, never an accredited qualification, and every legal figure hedged.
 *
 * ── Why this exists next to allergen-awareness ──────────────────────────────
 * allergen-awareness is the kitchen-facing course: the 14 named allergens,
 * where they hide, and the allergen matrix behind the menu. This one is the
 * floor and bar course, and it teaches the part of the chain that the matrix
 * cannot fix — the conversation. Taking the booking note, asking at the table,
 * writing it in the right field, saying it out loud to the kitchen, and getting
 * the right plate to the right chair. Most allergen incidents in service are not
 * a wrong matrix. They are a correct matrix and a broken handover.
 *
 * Keep the two apart when editing. If a lesson here starts explaining where
 * sesame hides, it belongs in allergen-awareness instead.
 *
 * ── The venue data it reads ─────────────────────────────────────────────────
 * Two sources, for two different jobs.
 *
 * Bookings (CourseReservation) feed LESSONS ONLY, deliberately, and are never
 * carried on the quiz ticket. Two reasons. A booking can be edited, cancelled or
 * created while somebody is mid-course, so grading against it would be grading
 * against a moving target. And the completion snapshot keeps whatever the quiz
 * read, which is not where guest dietary text belongs. Read the CourseReservation
 * doc comment in kit.ts before adding a field.
 *
 * The menu (dishes) feeds the graded questions, exactly as it does in
 * allergen-awareness, because dish ids ride on the ticket and rebuild identically
 * at submit time.
 *
 * ── What must never appear here ─────────────────────────────────────────────
 * No first aid. Not adrenaline auto-injector technique, not recovery position,
 * not dosage, not "how to treat" anything. Rotahr cannot deliver first aid
 * training through a screen and a wrong in-house first aid record is the one
 * that could get somebody hurt. The reaction lesson teaches one thing only:
 * recognise it, stop, get help fast, do not manage it yourself.
 */

import { ALLERGENS, type AllergenKey } from "./allergens";
import { type CourseReservation, type Lesson, type QuizQuestion, shuffled } from "./kit";

/**
 * The dish shape this course reads. Declared locally, structurally identical to
 * CourseDish in courses.ts — courses.ts imports this file, so importing the type
 * back from it would be a cycle.
 */
export interface FohDish {
  id: string;
  name: string;
  category: string;
  contains: AllergenKey[];
  traces: AllergenKey[];
  checked: boolean;
}

// --------------------------------------------------------------------------- //
// Small helpers
// --------------------------------------------------------------------------- //

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function label(key: AllergenKey): string {
  return ALLERGENS.find((a) => a.key === key)?.label ?? key;
}

/**
 * Words that mean "this could put somebody in hospital" as opposed to "this is
 * how they would prefer to eat".
 *
 * This is a teaching aid, not a classifier to be trusted. It exists so a lesson
 * can say "two of your six notes read like a genuine allergen" about the venue's
 * own data. It is deliberately conservative: anything it is unsure about counts
 * as needing a question asked, because the safe error is asking again.
 */
const ALLERGEN_WORDS = [
  "allerg",
  "anaphyl",
  "epipen",
  "coeliac",
  "celiac",
  "intoleran",
  "nut",
  "peanut",
  "gluten",
  "wheat",
  "dairy",
  "milk",
  "lactose",
  "egg",
  "fish",
  "shellfish",
  "prawn",
  "shrimp",
  "crab",
  "lobster",
  "mollusc",
  "mussel",
  "oyster",
  "soy",
  "soya",
  "sesame",
  "celery",
  "mustard",
  "sulphite",
  "sulfite",
  "lupin",
];

/** Words that describe a choice rather than a medical risk. */
const PREFERENCE_WORDS = [
  "vegan",
  "vegetarian",
  "veggie",
  "pescatarian",
  "halal",
  "kosher",
  "keto",
  "low carb",
  "no onion",
  "kids",
  "child",
  "high chair",
  "plant based",
];

function mentionsAllergen(text: string): boolean {
  const t = text.toLowerCase();
  return ALLERGEN_WORDS.some((w) => t.includes(w));
}

function mentionsPreference(text: string): boolean {
  const t = text.toLowerCase();
  return PREFERENCE_WORDS.some((w) => t.includes(w));
}

interface BookingShape {
  total: number;
  withDietary: number;
  dietaryTexts: string[];
  allergenish: string[];
  mixed: string[];
  preferenceOnly: string[];
  withKitchenNotes: number;
  dietaryWithoutKitchenNotes: number;
  largest: number;
}

function shapeOf(reservations: CourseReservation[]): BookingShape {
  const withDietary = reservations.filter((r) => r.dietary);
  const texts = withDietary.map((r) => r.dietary as string);
  return {
    total: reservations.length,
    withDietary: withDietary.length,
    dietaryTexts: texts,
    allergenish: texts.filter((t) => mentionsAllergen(t)),
    mixed: texts.filter((t) => mentionsAllergen(t) && mentionsPreference(t)),
    preferenceOnly: texts.filter((t) => !mentionsAllergen(t) && mentionsPreference(t)),
    withKitchenNotes: reservations.filter((r) => r.hasKitchenNotes).length,
    dietaryWithoutKitchenNotes: withDietary.filter((r) => !r.hasKitchenNotes).length,
    largest: reservations.reduce((m, r) => Math.max(m, r.partySize || 0), 0),
  };
}

/** Quote a handful of the venue's own dietary notes, shortest first, capped. */
function quoteNotes(texts: string[], max: number): string[] {
  return [...texts]
    .sort((a, b) => a.length - b.length)
    .slice(0, max)
    .map((t) => `"${t.length > 90 ? `${t.slice(0, 90)}…` : t}"`);
}

// --------------------------------------------------------------------------- //
// Lessons
// --------------------------------------------------------------------------- //

function chainLesson(): Lesson {
  return {
    id: "foh-chain",
    title: "The order is the safety step",
    body: [
      "A kitchen can hold a perfect allergen record for every dish on the menu and a guest can still be served the wrong plate. The information has to survive a chain of five handovers to be worth anything: the guest says it, somebody writes it down, the kitchen reads it, somebody cooks to it, and somebody carries the right plate to the right chair.",
      "Front of house owns three of those five links, and they are the three where nothing is written down by default. That is what this course is about. It is not about learning the fourteen named allergens off by heart — it is about the conversation, the note, and the handover.",
      "The single most common way this fails is not ignorance. It is assumption: assuming the booking note is complete, assuming the kitchen saw it, assuming the person carrying the plate knows which guest asked.",
    ],
    bullets: [
      "The guest tells you — you have to ask in a way that makes them tell you everything",
      "You write it down — in the field the kitchen actually reads",
      "The kitchen reads it — say it out loud as well, do not rely on the screen",
      "The kitchen cooks to it — that is their link, not yours",
      "The plate reaches the right guest — the last link, and the one most often broken",
    ],
    keyPoint:
      "You are not being asked to be an expert on allergens. You are being asked never to guess and never to assume the message got through.",
  };
}

function askingLesson(): Lesson {
  return {
    id: "foh-asking",
    title: "How to ask, and when",
    body: [
      "Ask twice. Once when the booking is taken, and again at the table before the order goes to the kitchen. A booking note written three weeks ago by somebody else is a prompt to ask, never an answer.",
      'Ask it as an open question. "Does anyone at the table have a food allergy or intolerance we need to know about?" gets a real answer. "No allergies, no?" gets a nod, and a nod is not information. Never ask it as a formality you are trying to get past.',
      "If the answer is yes, get three things straight before you leave the table: who at the table it is, what exactly they react to, and how they describe it. Then read it back to them in your own words. Reading it back is what catches the misunderstanding while it is still free to fix.",
      "Never answer from memory about a dish. Even if you are almost certainly right, the cost of being almost right is somebody in an ambulance. Say you will check, then check.",
    ],
    bullets: [
      "Ask at booking and again at the table — every time, not just when it looks likely",
      "Open question, never a closed one",
      "Who, what, and in their words",
      "Read it back before you leave the table",
      '"I will check" is always a better answer than a confident guess',
    ],
    keyPoint:
      "The question you ask badly is worse than no question, because it produces a note everybody then trusts.",
  };
}

function preferenceLesson(reservations: CourseReservation[]): Lesson {
  const s = shapeOf(reservations);

  const body = [
    "Dietary notes arrive as one blob of text, and they mix two completely different things. One half is medical: a reaction that ranges from uncomfortable to life-threatening. The other half is a choice — vegan, vegetarian, halal, kosher, low carb, no onions. Both deserve to be taken seriously and served well. Only one of them is a safety issue.",
    "It matters because the two need different handling. A preference that goes wrong is a disappointed guest and a remade plate. An allergen that goes wrong can be an ambulance. If everything in the note is treated as equally urgent, the urgent thing stops standing out — and if everything is treated as equally casual, so does it.",
    "It also runs the other way. Somebody who says they are vegan may be coeliac as well and not think to mention it, because they have got used to the two being read as the same kind of request. That is why you ask about allergies explicitly, even when a dietary note is already on the booking.",
  ];

  if (s.withDietary > 0) {
    const quotes = quoteNotes(s.dietaryTexts, 4);
    body.push(
      `Your own bookings show exactly this. ${s.withDietary} of the ${s.total} ${plural(
        s.total,
        "booking",
        "bookings"
      )} in the system carry a dietary note, and they read like this: ${quotes.join(", ")}.`
    );
    if (s.mixed.length > 0) {
      body.push(
        `${s.mixed.length} of those ${plural(
          s.mixed.length,
          "note mixes",
          "notes mix"
        )} a genuine allergen and a preference in the same line. That is the note that gets skim-read. Split it in your head before you act on it: which part of this could hurt somebody, and which part is how they would like to eat.`
      );
    }
    if (s.preferenceOnly.length > 0) {
      body.push(
        `${s.preferenceOnly.length} ${plural(
          s.preferenceOnly.length,
          "note reads",
          "notes read"
        )} as a preference only, with no allergen mentioned. That is not a reason to relax — it is a reason to ask at the table, because an allergy that was never written down is the most dangerous kind.`
      );
    }
  } else {
    body.push(
      `No booking in the system carries a dietary note yet, across ${s.total} ${plural(
        s.total,
        "booking",
        "bookings"
      )}. Read that carefully: it almost certainly does not mean no guest has had an allergy. It means the question either was not asked at booking, or the answer was not written into the dietary field where the kitchen can see it. An allergy that lives only in somebody's memory of a phone call is not recorded at all.`
    );
  }

  return {
    id: "foh-preference",
    title: "An allergy is not a preference",
    body,
    bullets: [
      "Allergy or intolerance: a safety issue, handled as one",
      "Vegan, vegetarian, halal, kosher, keto, no onion: a service issue, taken just as seriously",
      "A single note often contains both — separate them before you act",
      "A preference on the booking does not mean there is no allergy",
    ],
    keyPoint:
      "Ask yourself one question about every note: could this put somebody in hospital? Everything you do next follows from the answer.",
  };
}

function recordLesson(reservations: CourseReservation[]): Lesson {
  const s = shapeOf(reservations);

  const body = [
    "Where you write it decides whether it survives. A note in the wrong field, on a docket in your pocket, or shouted once across a busy pass is not a record — it is a hope.",
    "In Rotahr the dietary field on the booking is the one that travels: it is on the booking, it is on the day's list, and it is there for whoever is on shift when the table actually sits down, including people who were not there when the booking was taken. Free-text general notes are for the occasion and the seating. Kitchen notes are for what the kitchen has to act on.",
    "Write it in a way that survives being read fast by somebody who was not in the conversation. \"1 x severe peanut allergy — guest 3, seated by window\" is useful. \"Careful with nuts\" is not, because it does not say who, how severe, or what to do.",
  ];

  if (s.withDietary > 0 && s.dietaryWithoutKitchenNotes > 0) {
    body.push(
      `${s.dietaryWithoutKitchenNotes} of your ${s.withDietary} ${plural(
        s.withDietary,
        "booking",
        "bookings"
      )} with a dietary note ${plural(
        s.dietaryWithoutKitchenNotes,
        "has",
        "have"
      )} nothing written in the kitchen notes. That may be perfectly fine if the dietary line is clear enough to cook from. It is worth a look, though: if the kitchen reads one field and the floor writes another, the note exists and still does not arrive.`
    );
  }

  if (s.largest >= 6) {
    body.push(
      `The largest party in the system is ${s.largest} covers. Large tables are where allergen notes get lost, because the plates arrive together and nobody is sure which guest asked. On a table that size, the note has to name the seat, not just the party.`
    );
  }

  return {
    id: "foh-record",
    title: "Writing it where it survives",
    body,
    bullets: [
      "Dietary field on the booking — the line that travels to whoever is on shift",
      "Name the person or the seat, not just the table",
      "Say the reaction as the guest described it, not your summary of it",
      "Never a docket in your pocket and never memory alone",
    ],
    keyPoint:
      "Assume the person who serves that table has never spoken to that guest. Write the note for them.",
  };
}

function handoverLesson(): Lesson {
  return {
    id: "foh-handover",
    title: "Telling the kitchen, and getting the right plate back",
    body: [
      "Put it in writing and say it out loud. Two channels, because each one fails differently: a screen gets missed in a rush, and a spoken word gets forgotten. Together they rarely both fail.",
      "Get an acknowledgement. Not a nod in your direction — an actual repeat back. \"Table 12, no gluten, guest 2\" said back to you is the only proof the message landed.",
      "Then protect the plate on the way out. An allergen plate should be identifiable at the pass, carried separately or clearly marked, and handed to the guest who asked for it rather than put down in the middle of the table for people to sort out. If you are handing over to a runner, you hand over the information with the plate, every time. The most common serious error in service is not a wrong recipe — it is the right plate given to the wrong chair.",
      "One more habit: never top up, garnish, or swap a component on an allergen plate after it leaves the kitchen. Not the bread, not the butter, not the sauce, not the same tongs. If something needs adding, it goes back to the kitchen.",
    ],
    bullets: [
      "Written and spoken, always both",
      "Wait for it to be repeated back to you",
      "Mark it, carry it separately, hand it to the person",
      "Runner gets the plate and the information together",
      "No garnish, no top-up, no shared tongs after it leaves the kitchen",
    ],
    keyPoint:
      "The handover is not complete when you have said it. It is complete when somebody has said it back.",
  };
}

function menuLesson(dishes: FohDish[]): Lesson {
  const checked = dishes.filter((d) => d.checked);
  const unchecked = dishes.filter((d) => !d.checked);
  const withTraces = checked.filter((d) => d.traces.length > 0);

  const body = [
    "You are not expected to know your menu's allergens by heart. You are expected to know what your own records can and cannot tell you, and to be honest with a guest about the difference.",
  ];

  if (dishes.length === 0) {
    body.push(
      "No dishes are on the menu in Rotahr yet, so there is nothing here to read from. Until there is, treat every dish as unknown: check the recipe and the supplier spec, or ask the kitchen, before you answer a guest about anything."
    );
  } else if (checked.length === 0) {
    body.push(
      `There ${plural(dishes.length, "is", "are")} ${dishes.length} ${plural(
        dishes.length,
        "dish",
        "dishes"
      )} on the menu and not one of them has had its allergen information confirmed. That is worth saying plainly rather than working around: right now the menu cannot answer a single allergen question, so every answer has to come from the kitchen or the supplier spec. A manager can fix that under Training → Allergen matrix.`
    );
  } else {
    body.push(
      `${checked.length} of your ${dishes.length} ${plural(
        dishes.length,
        "dish",
        "dishes"
      )} ${plural(checked.length, "has", "have")} confirmed allergen information behind ${plural(
        checked.length,
        "it",
        "them"
      )}. That is the part you can quote to a guest.`
    );
    if (unchecked.length > 0) {
      body.push(
        `The other ${unchecked.length} ${plural(
          unchecked.length,
          "has",
          "have"
        )} never been checked: ${unchecked
          .slice(0, 6)
          .map((d) => d.name)
          .join(", ")}${unchecked.length > 6 ? ", and others" : ""}. A blank record is not a confirmed absence. For those dishes the honest answer is "let me check with the kitchen", not "that one should be fine".`
      );
    }
    if (withTraces.length > 0) {
      body.push(
        `${withTraces.length} of your confirmed ${plural(
          withTraces.length,
          "dish carries",
          "dishes carry"
        )} a traces warning — for example ${withTraces
          .slice(0, 3)
          .map((d) => `${d.name} (${d.traces.map(label).join(", ")})`)
          .join("; ")}. Traces means the kitchen cannot rule it out, and for a severe allergy that is a no, not a maybe.`
      );
    }
  }

  return {
    id: "foh-menu",
    title: "Your own menu, and what it can answer",
    body,
    bullets: [
      "Confirmed record: you can quote it",
      "Blank record: you cannot, and saying so is the right answer",
      "Traces: the kitchen cannot rule it out — treat it as a no for a severe allergy",
      "Recipe changed or supplier swapped? The record has to be re-checked before anyone quotes it",
    ],
    keyPoint:
      "\"I do not know, I will find out\" costs a guest two minutes. Guessing can cost them a lot more.",
  };
}

function noLesson(): Lesson {
  return {
    id: "foh-no",
    title: "Saying no, and meaning it",
    body: [
      "Sometimes the right answer is that the kitchen cannot serve that guest safely today. A fryer shared with battered fish, one small kitchen with flour in the air, a sauce made off-site with no spec to hand — those are real limits, and pretending otherwise to avoid an awkward moment is the worst decision available.",
      "Say it plainly, early, and without apology theatre: what you cannot guarantee, and what you can offer instead. Most guests with a serious allergy have heard it before and would far rather hear it than be served a plate somebody hoped was fine.",
      "Pressure to say yes usually comes from wanting to please, not from anybody demanding it. Notice that in yourself. A guest asking three times whether it is definitely fine is not asking you to change your answer — they are asking you to be sure.",
      "And be careful with words that sound like a guarantee. \"Should be fine\", \"I think so\", \"probably nothing in that\" all get heard as yes. If you would not put your name to it in writing, do not say it out loud.",
    ],
    bullets: [
      "A shared fryer, a floury room or an unspecced sauce is a real limit",
      "Say what you cannot guarantee, then offer what you can",
      "Never let wanting to please turn into a guarantee you cannot back",
      '"Should be fine" is heard as "yes"',
    ],
    keyPoint:
      "An honest no protects the guest and the venue. A hopeful yes protects nobody.",
  };
}

function reactionLesson(): Lesson {
  return {
    id: "foh-reaction",
    title: "If a guest reacts",
    body: [
      "This is not first aid training and Rotahr cannot give you any. What follows is what front-of-house staff are expected to do in the first minute, which is mostly about speed and not about treatment.",
      "The signs staff notice first are usually a guest stopping eating and looking distressed, sudden swelling of the lips, face or tongue, a hoarse voice or difficulty breathing or swallowing, widespread hives, sudden severe stomach pain and vomiting, or a guest going pale, faint or collapsing. It can develop within minutes.",
      "What you do: stop service to that guest immediately, do not let them get up and walk anywhere, tell the manager or supervisor at once, and get the emergency services called without waiting to see whether it improves. If the guest has their own prescribed medication and asks for it, help them get to it — you do not administer anything yourself and you do not decide on their behalf.",
      "Then protect the evidence. Do not clear the plate, do not scrape it, do not throw out the packaging. Keep the plate and anything it was made from exactly as it is, and write down what was ordered, what was said, and when. That record is how the venue finds out what actually happened, and it is the only thing that protects everybody involved afterwards.",
      "Nobody will ever be in trouble for calling for help too early. The only wrong call is waiting.",
    ],
    bullets: [
      "Stop service to that guest, keep them seated",
      "Tell a manager immediately — do not manage it alone",
      "Get emergency services called, do not wait and see",
      "Never administer anything yourself",
      "Keep the plate, the packaging and a written note of what happened",
    ],
    keyPoint:
      "Your job is recognise, stop, and get help fast. Treating it is not your job and never will be.",
  };
}

export function fohAllergenLessons(
  dishes: FohDish[],
  reservations: CourseReservation[]
): Lesson[] {
  return [
    chainLesson(),
    askingLesson(),
    preferenceLesson(reservations),
    recordLesson(reservations),
    handoverLesson(),
    menuLesson(dishes),
    noLesson(),
    reactionLesson(),
  ];
}

// --------------------------------------------------------------------------- //
// Quiz
// --------------------------------------------------------------------------- //

/**
 * Knowledge questions. Every one is a service decision rather than a fact to
 * recall — "where does sesame hide" belongs to allergen-awareness.
 */
export function fohBank(): QuizQuestion[] {
  return [
    {
      id: "f-ask-open",
      kind: "single",
      prompt: "Which way of asking is most likely to get a complete answer at the table?",
      options: [
        '"No allergies, no?"',
        '"Does anyone at the table have a food allergy or intolerance we need to know about?"',
        '"You would have told us at booking if there were allergies, right?"',
        '"Everything on the menu is pretty safe — anything I should know?"',
      ],
      correct: [1],
      why: "An open question invites the whole answer. A closed one invites a nod, and a nod is not information.",
    },
    {
      id: "f-ask-twice",
      kind: "single",
      prompt:
        "A booking taken three weeks ago has a dietary note on it. What is that note for?",
      options: [
        "It is the answer — no need to raise it again at the table",
        "It is a prompt to ask again at the table and confirm who and what",
        "It only matters if the kitchen asks about it",
        "It should be deleted once the table sits down",
      ],
      correct: [1],
      why: "A note written weeks ago by somebody else, possibly about a different guest in the party, is a prompt. Confirmation happens at the table.",
    },
    {
      id: "f-readback",
      kind: "single",
      prompt: "Why read the allergen information back to the guest before leaving the table?",
      options: [
        "It shows attentive service",
        "It catches a misunderstanding while it is still free to fix",
        "It is required by law in every country",
        "It saves the kitchen having to check",
      ],
      correct: [1],
      why: "Reading it back is the cheapest error check in the whole chain. Everything after it is expensive.",
    },
    {
      id: "f-vs-preference",
      kind: "multi",
      prompt:
        'A booking note reads "2 vegan, 1 nut allergy, 1 no onions". Which statements are correct?',
      note: "Select all that apply.",
      options: [
        "The nut allergy is the safety issue and has to be handled as one",
        "The vegan and no-onion requests should be served well, but they are service issues not safety issues",
        "All four should be treated identically so nothing gets missed",
        "You still ask at the table who the nut allergy belongs to",
        "Vegan can be assumed to mean dairy allergy",
      ],
      correct: [0, 1, 3],
      why: "Take all of it seriously, but only one line could put somebody in hospital. Treating everything identically is how the urgent thing stops standing out. And vegan is a choice, not an allergy.",
    },
    {
      id: "f-preference-relax",
      kind: "single",
      prompt:
        "A booking carries a dietary note that mentions only preferences — vegetarian and a high chair. What follows?",
      options: [
        "No allergen question is needed for that table",
        "You still ask about allergies at the table, because an allergy that was never written down is the most dangerous kind",
        "The kitchen will ask if it matters",
        "It means the guest has no allergies",
      ],
      correct: [1],
      why: "The absence of a note is not evidence. Plenty of guests assume a dietary note covers it, or that somebody else in the party mentioned it.",
    },
    {
      id: "f-memory",
      kind: "single",
      prompt:
        "You are fairly sure the chowder has no gluten in it, but you have not checked today. A guest with coeliac disease asks. What do you say?",
      options: [
        "That it should be fine",
        "That you will check and come back — then check the record or ask the kitchen",
        "That you think so but they should decide",
        "That you can ask the kitchen to leave the bread off",
      ],
      correct: [1],
      why: "Fairly sure is a guess with a confident voice. Recipes and suppliers change without the dish looking any different.",
    },
    {
      id: "f-hedge-words",
      kind: "multi",
      prompt: "Which of these phrases will a guest hear as a yes?",
      note: "Select all that apply.",
      options: [
        '"That should be fine"',
        '"I think there is nothing in that one"',
        '"I do not know — let me check with the kitchen and come back to you"',
        '"Probably no dairy in that"',
      ],
      correct: [0, 1, 3],
      why: "Hedged phrases get heard as approval. Only the honest one is heard as what it is.",
    },
    {
      id: "f-handover",
      kind: "multi",
      prompt: "You are passing an allergen order to the kitchen. What does a complete handover include?",
      note: "Select all that apply.",
      options: [
        "It goes in writing on the order",
        "You also say it out loud",
        "You wait for it to be repeated back to you",
        "You mention it if the kitchen looks like they have time",
        "It names which guest or seat it belongs to",
      ],
      correct: [0, 1, 2, 4],
      why: "Written and spoken fail in different ways, so use both, and the repeat back is the only proof it landed. Which seat matters as much as which allergen.",
    },
    {
      id: "f-runner",
      kind: "single",
      prompt:
        "A runner is taking plates to a table that includes one allergen order. What has to happen?",
      options: [
        "Nothing extra — the plate is already correct",
        "The runner is told which plate it is and which guest it belongs to, and hands it to that guest directly",
        "The plate goes down in the middle for the table to sort out",
        "The runner should ask the table who ordered it",
      ],
      correct: [1],
      why: "The right plate at the wrong chair is one of the most common serious errors in service. The information travels with the plate.",
    },
    {
      id: "f-topup",
      kind: "single",
      prompt:
        "An allergen plate has left the kitchen and the guest asks for extra dressing. What do you do?",
      options: [
        "Add it from the service station using the usual spoon",
        "Take it back to the kitchen so it can be added against the allergen information",
        "Add it but mention it to the guest",
        "Bring the dressing on the side in any container to hand",
      ],
      correct: [1],
      why: "Once a plate is out of the kitchen, anything added has not been checked against the allergen information, and shared utensils are a cross-contact route.",
    },
    {
      id: "f-traces",
      kind: "single",
      prompt:
        'Your record for a dish says it "may contain traces of nuts". A guest with a severe nut allergy asks for it. What is that record telling you?',
      options: [
        "The dish is fine because nuts are not an ingredient",
        "The kitchen cannot rule it out, so for a severe allergy that is a no rather than a maybe",
        "The guest can decide for themselves and that settles it",
        "It only matters if they eat a large portion",
      ],
      correct: [1],
      why: "A traces warning is the kitchen saying it cannot guarantee absence. For a severe allergy, that is not a risk to hand to the guest with a shrug.",
    },
    {
      id: "f-blank",
      kind: "single",
      prompt: "A dish on your menu has no allergen information recorded at all. What does that mean?",
      options: [
        "It contains no allergens",
        "It is unknown, and unknown is not the same as safe — check before answering",
        "It is safe for everything except gluten",
        "It should be taken off the menu immediately",
      ],
      correct: [1],
      why: "A blank record is an absence of information, not a confirmed absence of allergens.",
    },
    {
      id: "f-cannot-serve",
      kind: "single",
      prompt:
        "The kitchen has one fryer and it is used for battered fish. A guest with a severe fish allergy wants the chips. What is the right handling?",
      options: [
        "Serve them and say nothing — the chips contain no fish",
        "Tell the guest plainly what cannot be guaranteed and offer an alternative",
        "Serve them but warn the guest as you put the plate down",
        "Ask the guest whether they mind",
      ],
      correct: [1],
      why: "A shared fryer is a real limit. Stating it early and offering an alternative is honest service; serving first and warning later is not.",
    },
    {
      id: "f-pressure",
      kind: "single",
      prompt:
        "A guest asks three times whether a dish is definitely safe for their allergy. What are they doing?",
      options: [
        "Being difficult",
        "Asking you to be certain — not asking you to change your answer",
        "Hinting that they want a discount",
        "Testing whether the staff are trained",
      ],
      correct: [1],
      why: "Repeated asking is a request for certainty. Reading it as pressure to say yes is how a hopeful yes gets given.",
    },
    {
      id: "f-signs",
      kind: "multi",
      prompt: "Which of these should make you stop service and get help immediately?",
      note: "Select all that apply.",
      options: [
        "Sudden swelling of the lips, face or tongue",
        "A hoarse voice, or difficulty breathing or swallowing",
        "A guest going pale, faint or collapsing",
        "A guest saying the dish is a bit too salty",
        "Widespread hives with sudden severe stomach pain and vomiting",
      ],
      correct: [0, 1, 2, 4],
      why: "These are the signs floor staff notice first, and they can develop within minutes. Waiting to see whether it settles is the wrong call.",
    },
    {
      id: "f-reaction-role",
      kind: "single",
      prompt:
        "A guest appears to be having a serious allergic reaction. What is front-of-house expected to do?",
      options: [
        "Administer the guest's medication for them",
        "Stop service to that guest, keep them seated, tell a manager at once and get emergency services called",
        "Wait a few minutes to see whether it settles before disturbing anyone",
        "Move the guest outside for fresh air",
      ],
      correct: [1],
      why: "Recognise, stop, get help. Treatment is not a front-of-house job and this course does not qualify anybody to give it. If the guest asks for their own prescribed medication, help them reach it — never administer it for them.",
    },
    {
      id: "f-evidence",
      kind: "single",
      prompt: "After a suspected reaction, what happens to the plate?",
      options: [
        "It gets cleared and washed like any other",
        "It is kept exactly as it is, along with any packaging, and what was ordered and said is written down",
        "It is photographed and then cleared",
        "It is sent back to the kitchen to be re-made for comparison",
      ],
      correct: [1],
      why: "The plate and the packaging are how the venue finds out what actually happened. Clearing it destroys the only evidence, which helps nobody, including the staff involved.",
    },
    {
      id: "f-chain",
      kind: "single",
      prompt:
        "The kitchen holds a complete and correct allergen record for every dish. What can still go wrong on the floor?",
      options: [
        "Nothing — a correct record is the whole job",
        "The question is not asked, the note is written where nobody reads it, the handover is not acknowledged, or the plate reaches the wrong guest",
        "Only the kitchen can make a mistake at that point",
        "The record expires each service",
      ],
      correct: [1],
      why: "Most incidents in service are not a wrong matrix. They are a correct matrix and a broken handover.",
    },
  ];
}

/**
 * Questions built from the venue's own menu. Dishes ride on the quiz ticket, so
 * these rebuild identically at grading time.
 *
 * Deliberately different in shape from the menu questions in allergen-awareness:
 * those ask what is recorded, these ask what you say to a guest given what is
 * recorded, which is the thing this course is for. A trainee who has done both
 * courses should not get the same paper twice.
 */
function menuQuestions(dishes: FohDish[], seed: number): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  const checked = dishes.filter((d) => d.checked);
  const unchecked = dishes.filter((d) => !d.checked);

  if (dishes.length === 0) return out;

  // 1. A confirmed dish with allergens recorded: can you read your own record?
  const withAllergens = shuffled(
    checked.filter((d) => d.contains.length > 0),
    seed
  );
  const dish = withAllergens[0];
  if (dish) {
    const truth = dish.contains;
    const decoys = shuffled(
      ALLERGENS.filter((a) => !truth.includes(a.key)).map((a) => a.key),
      seed + dish.id.length
    ).slice(0, Math.max(2, 5 - truth.length));
    const keys = shuffled([...truth, ...decoys], seed + 3);
    out.push({
      id: `fm-${dish.id}`,
      kind: "multi",
      prompt: `A guest asks what is in "${dish.name}". Which allergens does your own confirmed record list against it?`,
      note: "Select all that apply. This is your venue's own recorded information.",
      options: keys.map(label),
      correct: keys.map((k, i) => (truth.includes(k) ? i : -1)).filter((i) => i >= 0),
      why: `Your record for ${dish.name} lists ${truth.map(label).join(", ")}. Quoting your own record is fine; quoting your memory is not.`,
    });
  }

  // 2. A traces dish, if there is one — the answer that is a no, not a maybe.
  const tracesDish = shuffled(
    checked.filter((d) => d.traces.length > 0),
    seed + 11
  )[0];
  if (tracesDish) {
    const t = tracesDish.traces.map(label).join(", ");
    out.push({
      id: `ft-${tracesDish.id}`,
      kind: "single",
      prompt: `Your record for "${tracesDish.name}" carries a traces warning for ${t}. A guest with a severe allergy to that asks for it. What do you tell them?`,
      options: [
        `That it is fine, because ${t} is not an ingredient`,
        `That the kitchen cannot rule ${t} out for that dish, and offer an alternative you can stand behind`,
        "That they can try a small amount and see",
        "That the warning is only there for legal reasons",
      ],
      correct: [1],
      why: `The traces line on ${tracesDish.name} is the kitchen saying it cannot guarantee absence. For a severe allergy that is a no.`,
    });
  }

  // 3. The unchecked count — their number, and the habit it demands.
  if (unchecked.length > 0) {
    out.push({
      id: `fu-${unchecked.length}-${dishes.length}`,
      kind: "single",
      prompt: `${unchecked.length} of the ${dishes.length} ${plural(
        dishes.length,
        "dish",
        "dishes"
      )} on your menu ${plural(
        unchecked.length,
        "has",
        "have"
      )} never had allergen information confirmed. What does that mean for you on the floor?`,
      options: [
        `Those ${plural(unchecked.length, "dish is", "dishes are")} allergen free`,
        `You cannot answer an allergen question about ${plural(
          unchecked.length,
          "it",
          "them"
        )} from the record — it has to come from the kitchen or the supplier spec`,
        "You should stop selling them",
        "It only matters for the kitchen team",
      ],
      correct: [1],
      why: "An unconfirmed dish is an unknown. The honest answer is that you will check, and a manager can close the gap under Training → Allergen matrix.",
    });
  } else if (checked.length > 0) {
    out.push({
      id: `fu-all-${dishes.length}`,
      kind: "single",
      prompt: `All ${dishes.length} ${plural(
        dishes.length,
        "dish",
        "dishes"
      )} on your menu ${plural(dishes.length, "has", "have")} confirmed allergen information. What still has to be true for that to be safe to quote?`,
      options: [
        "Nothing — once confirmed, it stays confirmed",
        "It has to be re-checked whenever a recipe changes or a supplier is swapped, because either can change the allergens without the dish looking different",
        "It only has to be re-checked once a year",
        "It only matters if a guest complains",
      ],
      correct: [1],
      why: "A confirmed record is a snapshot. A new supplier for the same sauce can change the allergens with nothing visible on the plate.",
    });
  }

  return out;
}

export function fohAllergenQuiz(dishes: FohDish[], seed: number): QuizQuestion[] {
  const fromMenu = menuQuestions(dishes, seed);
  const wanted = 12;
  const knowledge = shuffled(fohBank(), seed).slice(
    0,
    Math.max(8, wanted - fromMenu.length)
  );
  return shuffled([...knowledge, ...fromMenu], seed + 5);
}
