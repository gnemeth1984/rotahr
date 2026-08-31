/**
 * Knife and equipment safety — in-house course content.
 *
 * ── What this is ────────────────────────────────────────────────────────────
 * Employer-delivered awareness for the two things that actually put kitchen and
 * bar staff in a waiting room: blades and powered machines. Knives, mandolins,
 * slicers, mincers, blenders and mixers, plus the burn side of hot equipment and
 * the discipline of isolating a machine before your hands go anywhere near it.
 *
 * The venue's own equipment register is woven in, so the lesson names the actual
 * machines in the building rather than talking about "equipment" in general.
 *
 * ── What this is NOT ────────────────────────────────────────────────────────
 * It is NOT first aid training, and nothing in it teaches anybody how to treat a
 * wound, a severed fingertip or a burn. That has to be delivered hands-on by a
 * qualified instructor and it is tracked in Rotahr as a real FIRST_AID
 * certificate, not delivered here.
 *
 * It is NOT engineer training either. Nothing here authorises anybody to strip,
 * repair or re-guard a machine. The whole point of the course is the opposite:
 * know what you are allowed to touch, isolate it before you touch it, and get a
 * faulty machine out of use and recorded.
 *
 * Fire is deliberately absent. Hot oil appears here only as a burn and scald
 * hazard. Ignition, extinguisher types, extraction grease and evacuation belong
 * to the fire safety awareness course and are not repeated.
 *
 * Chemicals, dilutions and contact times belong to the cleaning and chemical
 * safety course. Date labels and hygiene rules belong to food hygiene. This
 * course covers the mechanical and thermal risk of the kit itself.
 *
 * Guarding and maintenance duties vary by country. Every figure and duty here is
 * stated as common practice with a nudge to check local requirements.
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

/**
 * Categories where a unit normally has a moving part, a blade, a heated surface
 * or a pressure vessel — the things you isolate before your hands go inside.
 * Refrigeration is on the list because of the fan and the compressor, not
 * because it is hot.
 */
const HANDS_INSIDE_CATEGORIES = new Set([
  "cooking",
  "dishwashing",
  "bar",
  "coffee",
  "refrigeration",
  "hvac",
  "electrical",
]);

/** Categories with nothing powered to isolate — useful as honest decoys. */
const INERT_CATEGORIES = new Set(["furniture", "pos", "plumbing"]);

const OUT_OF_USE_STATUSES = new Set(["faulty", "awaiting_parts", "out_of_service"]);

function label(a: CourseAsset): string {
  const bits: string[] = [];
  if (a.location) bits.push(a.location);
  bits.push(CATEGORY_LABEL[a.category] ?? a.category);
  return `${a.name} — ${bits.join(", ")}`;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

// --------------------------------------------------------------------------- //
// The venue-data lesson
// --------------------------------------------------------------------------- //

/**
 * The register lesson. Written empty-first on purpose: most venues on the
 * platform have not built the register yet, so the blank case is the one staff
 * will actually read, and it has to be the strongest page in the course rather
 * than an apology.
 */
function registerLesson(assets: CourseAsset[]): Lesson {
  const live = assets.filter((a) => a.status !== "retired");
  const powered = live.filter((a) => HANDS_INSIDE_CATEGORIES.has(a.category));
  const outOfUse = live.filter((a) => OUT_OF_USE_STATUSES.has(a.status));
  const overdue = live.filter((a) => a.serviceOverdue);
  const noService = live.filter((a) => !a.nextServiceDate);
  const noLocation = live.filter((a) => !a.location);

  if (live.length === 0) {
    return {
      id: "ke-register",
      title: "Your own equipment",
      body: [
        "This lesson normally lists the machines recorded in this building by name — the slicer, the mincer, the mixer, the ovens, the dishwasher, the coffee machine — with their service dates and whether any of them are currently out of use. Your register has nothing on it, so there is nothing to name.",
        "Take that seriously rather than skipping past it. An empty register does not mean an empty kitchen. It means nobody has written down what is in the room, so nothing about that kit is scheduled, nothing is chased, and nobody can tell from a record which machine is safe to use tonight and which one is waiting on a part. The knowledge lives in whoever happens to be on shift, and it leaves the building when they do.",
        "It matters most on the day something goes wrong. A machine with a new noise gets taken out of use, and the next person needs to know that without being told in person. A blade guard goes missing and somebody has to be able to see that the unit is not to be used. A service is due and the reminder has to fire at somebody. All of that runs off the register.",
        "A manager can build it under Log book → Equipment: name, category, where it lives, and the next service date. Fifteen minutes of walking around with a phone covers most kitchens. Once it is filled in, this lesson and the questions at the end name your actual machines instead of talking in general terms, and the service reminders start chasing you instead of the other way round.",
        "Until then, do the walk yourself and know these three things for every machine you use: where its isolation switch or plug is, whether it has a guard and whether that guard is on it right now, and who in this building is allowed to take it apart for cleaning. If you cannot answer all three for a machine, do not put your hands inside it.",
      ],
      keyPoint:
        "A blank equipment register is not evidence that the kit is fine. It only means nobody has written it down yet, and it is the manager's job to fix that, not yours to work around.",
    };
  }

  const body: string[] = [
    "This is the part no outside training provider can give you: the equipment recorded in this building, by name. Read the list. You are not being asked to memorise it, you are being asked to recognise the kit you work beside and know what each item needs before you put your hands in it.",
  ];

  if (powered.length > 0) {
    body.push(
      `${powered.length} of the ${live.length} ${
        live.length === 1 ? "item" : "items"
      } on your register ${
        powered.length === 1 ? "has" : "have"
      } a moving part, a heated surface or a blade — a motor, a fan, a compressor, an element or an edge. Every one of those is a unit you isolate before cleaning, unjamming or reaching inside, not one you simply switch off at the dial.`
    );
  }

  if (outOfUse.length > 0) {
    body.push(
      `${
        outOfUse.length === 1 ? "One item is" : `${outOfUse.length} items are`
      } currently recorded as not fit for use: ${outOfUse
        .map((a) => `${a.name} (${statusLabel(a.status)})`)
        .join(", ")}. That status is an instruction, not a note. Nobody uses those units, not even briefly, not even because service is busy, until somebody competent has repaired them and the record has been changed back.`
    );
  }

  if (overdue.length > 0) {
    body.push(
      `${
        overdue.length === 1 ? "One item is" : `${overdue.length} items are`
      } past the service date recorded against ${overdue.length === 1 ? "it" : "them"}: ${overdue
        .map((a) => `${a.name} (was due ${niceDate(a.nextServiceDate)})`)
        .join(", ")}. On a machine with a blade or a guard, a service is the visit where somebody checks that the interlock still stops it and that the guard still fits. Overdue means nobody has checked. Tell a manager.`
    );
  }

  if (noService.length > 0) {
    body.push(
      noService.length === live.length
        ? `Nothing on your register has a next service date recorded. That means no reminder can fire for any of it, and nobody can tell from the record when a guard or an interlock was last looked at. It is a five-minute fix for a manager and it is worth asking for.`
        : `${noService.length} of the ${live.length} items have no next service date recorded, so no reminder will ever fire for ${
            noService.length === 1 ? "it" : "them"
          }. Worth asking a manager to fill those in.`
    );
  }

  if (noLocation.length === live.length && live.length > 1) {
    body.push(
      "None of these items have a location recorded either. That sounds like paperwork until the night somebody has to isolate one fast, or until an engineer arrives and has to be walked around the building to find the unit they came for."
    );
  }

  return {
    id: "ke-register",
    title: "Your own equipment",
    body,
    bullets: live.map((a) => {
      const service = a.nextServiceDate
        ? a.serviceOverdue
          ? ` — service OVERDUE, was due ${niceDate(a.nextServiceDate)}`
          : ` — next service ${niceDate(a.nextServiceDate)}`
        : " — no service date recorded";
      const flag = OUT_OF_USE_STATUSES.has(a.status) ? ` [${statusLabel(a.status)} — do not use]` : "";
      return `${label(a)}${service}${flag}`;
    }),
    keyPoint:
      "Know three things about every machine you use: where it isolates, whether its guard is on it right now, and who is allowed to strip it. If you cannot answer all three, do not put your hands inside it.",
  };
}

// --------------------------------------------------------------------------- //
// Lessons
// --------------------------------------------------------------------------- //

export function knifeEquipmentLessons(assets: CourseAsset[]): Lesson[] {
  return [
    {
      id: "ke-why",
      title: "Why this is the injury that gets you",
      body: [
        "Cuts and contact with machinery are, year after year, among the most common reportable injuries in food service. Not dramatic ones, mostly: a hand steadying a slicer, a thumb on a mandolin at the end of a block of celeriac, a finger clearing a jammed mincer that somebody forgot was still plugged in.",
        "The reason is not carelessness. It is the conditions. You are working at pace, against a ticket time, with wet hands, on a surface that is also wet, often at the end of a long shift, with the person beside you moving through the same square metre. Every one of those raises the odds a little, and the equipment does not care how experienced you are.",
        "The severity is what makes this course worth twenty minutes. A knife cut is usually a plaster and a bad ten minutes. A slicer or a mincer does not stop at the skin, and there is no version of that injury that heals quickly. The gap between the two is almost entirely down to guards, isolation and whether somebody rushed one step.",
        "In most countries the operator has to provide equipment that is suitable and maintained, keep the guards on it, and make sure anybody using it has been instructed. The exact wording and the exact duties differ from country to country — check your own local requirements rather than relying on any figure in training material, including this course.",
      ],
      bullets: [
        "Blades and moving parts do not get more forgiving with experience.",
        "The conditions do most of the damage: pace, wet hands, wet floors, tired hands, crowded benches.",
        "A knife cut is a bad day. A machine injury is a different category entirely.",
      ],
      keyPoint:
        "This course is not about being careful. It is about the three or four specific habits that decide whether a slip becomes a plaster or a hospital visit.",
    },
    {
      id: "ke-knives",
      title: "Knives",
      body: [
        "A sharp knife is safer than a blunt one. That sounds backwards and it is the single most useful thing on this page. A blunt blade needs force, force makes it skid off skin and gristle, and a skidding blade under pressure goes exactly where your other hand is. Keep them sharp and keep them for the job they are for.",
        "The board is half of it. A board that slides is a knife that goes where you did not aim it, so use a damp cloth or a mat under it and work on a bench that is clear enough to put the knife down without hunting for a space. Cut away from your body, keep the guiding hand curled with the fingertips tucked back behind the knuckles, and give the cut your attention while it is happening.",
        "The wrong tool is a large share of kitchen cuts. A chef's knife is not a box cutter, a screwdriver, a tin opener or a chisel for frozen product. Prising, stabbing and levering are how tips snap and how blades slip off a hard surface at speed.",
        "The rest is handling, and it is mostly about the people around you. Carry a knife with the point down and the blade turned back, arm straight at your side, and say something as you pass behind somebody. Never hold one while carrying anything else, and never gesture with one.",
        "Never leave a knife in a sink, in a bowl of water, under a cloth or anywhere it cannot be seen. That is how the person washing up gets cut by a knife they did not know was there, and it is the most avoidable injury in the building. Wash it separately, blade away from your hand, dry it and put it away in a block, a rack or a sheath. Never loose in a drawer.",
        "If a knife falls, let it fall. Step back and let it land. Nobody has ever caught a falling knife well.",
      ],
      bullets: [
        "Sharp beats blunt. Blunt needs force and force skids.",
        "Stable board, clear bench, cut away from you, guiding hand curled.",
        "Right knife for the job. Never as a lever, an opener or a chisel.",
        "Point down, blade back, arm at your side, speak as you pass.",
        "Never in a sink, never under a cloth, never loose in a drawer.",
      ],
      keyPoint:
        "A knife you cannot see is the dangerous one. Put it down where it is visible, wash it separately, and store it in a block, rack or sheath.",
    },
    {
      id: "ke-cut",
      title: "When somebody does get cut",
      body: [
        "This is not first aid training and it does not attempt to be. Nothing here tells you how to treat a wound, and this course does not qualify anybody to do so. What follows is only what happens to the work and the food, plus the one instruction that always applies: for anything more than a minor nick, get the person to somebody trained in first aid, and call the emergency services if there is any doubt about how bad it is.",
        "Stop working. Not after this order, not after this pan. A cut hand keeps bleeding while it keeps working, and every second it stays over food makes the second problem worse.",
        "The food side is simple and non-negotiable. Anything the wound or the blood has been in contact with is thrown away, the board and the knife go out of service until they are cleaned properly, and the cut is covered with a blue detectable dressing before that person goes anywhere near food again. Blue because there is no blue food, and detectable because a metal strip is findable if it comes off in a batch.",
        "Then it gets recorded. A cut that needed anything more than a wipe goes in the accident record, with what happened and on which machine or which knife. That record is not about blame. It is the only way anybody spots that the same slicer has taken two fingers in a year, or that the cuts all happen on the same board at the same wet station.",
        "And if the injury came off a machine, that machine comes out of use until somebody has worked out why. An injury is the loudest possible fault report.",
      ],
      bullets: [
        "Not first aid training. Anything beyond a minor nick goes to somebody trained, and to emergency services if in doubt.",
        "Stop working immediately.",
        "Affected food is binned; board and knife out of use until properly cleaned.",
        "Blue detectable dressing before returning to food.",
        "Record it, and take the machine out of use if a machine caused it.",
      ],
      keyPoint:
        "The three things this course does ask of you: stop, cover it blue, and write it down. Treatment is for somebody trained in first aid, not for you and not for this course.",
    },
    {
      id: "ke-machines",
      title: "Machines with blades and moving parts",
      body: [
        "Slicers, mandolins, mincers, food processors, stick blenders, dough mixers, ice machines, waste disposals, dishwasher racks with a hot arm inside them. The list changes by venue and the rule does not: a machine with a moving part is only safe while the guard is on it and your hands are outside it.",
        "The guard is not an inconvenience the manufacturer added for legal reasons. It is the reason the machine is legal to sell. A slicer's gauge plate, a mincer's throat and hopper, a mixer's bowl cage and a processor's lid interlock all exist because somebody was injured before they existed. A machine with its guard removed is a machine out of use, full stop, and reporting that is not telling tales — it is the only thing standing between the next person and an amputation.",
        "Never defeat an interlock. Taping a switch, wedging a lid, holding a bowl cage up with a cloth, jamming a magnet on a sensor: all of it turns a designed-safe machine into an open blade that runs while you are inside it. If somebody shows you that trick as a time-saver, that is the moment to tell a manager.",
        "Feed with the tool, never the hand. Mincers and processors come with a pusher or a dolly because a hand cannot be pulled back out of a screw feed. Mandolins come with a holder, and the last third of the vegetable is where the injuries happen — use the holder or a cut-resistant glove, or stop and finish it with a knife. There is no prize for the last few slices.",
        "Nothing loose goes near a moving part. Apron strings, a tea towel over the shoulder, a long sleeve, a watch, a ring, a lanyard, hair. A mixer or a screw feed takes hold of the fabric first and takes the hand in afterwards.",
        "And if you have not been shown a machine, you do not run it. Not the slicer, not the mincer, not the mixer. Being shown means somebody competent walked you through it on that specific machine, not that you have used one like it somewhere else.",
      ],
      bullets: [
        "Guard off means machine out of use. Report it.",
        "Never tape, wedge or bypass an interlock.",
        "Feed with the pusher, the dolly or the holder. Never the hand.",
        "The last third of a mandolin block is where hands get hurt.",
        "Nothing loose: strings, sleeves, cloths, watches, rings, hair.",
        "Not shown on that machine means not using that machine.",
      ],
      keyPoint:
        "The guard and the interlock are the machine's safety, not its inconvenience. Anything that defeats either one takes the machine out of use until a manager knows.",
    },
    {
      id: "ke-isolate",
      title: "Off is not the same as safe",
      body: [
        "Almost every serious machine injury in a kitchen happens during cleaning, unjamming or a blade change, and almost all of those happen because the machine was off rather than isolated. Off is a dial position. Isolated means the machine cannot start, no matter what anybody presses, leans on or knocks.",
        "So the sequence before your hands go inside anything is: switch it off, unplug it at the socket or turn it off at the isolator, and keep the plug where you can see it while you work. If the machine is hard-wired and somebody else can reach the isolator, tell them, and where the site has a lockout system, use it. A plug lying visibly on the bench beside you is the simplest lockout there is.",
        "Blades in particular. On a slicer, set the gauge plate to zero and close it before you clean, because the exposed rim of a slicer blade cuts just as well standing still as it does spinning. Take blades out only if you have been shown how on that machine, carry them flat, wash them one at a time, and never leave one in a sink or on a drainer under a cloth.",
        "Jams are the moment people forget everything above. A jammed mincer, processor or ice machine gets isolated first and cleared with the tool, never with fingers and never with the machine live. A stored spring, a compressed screw feed or a stiff blade can move suddenly the instant the obstruction gives.",
        "Then think about what you are cleaning with. Wet hands on an electrical switch, a hose near a control panel, water going where the motor is: that is a shock risk and it is also how you kill a machine. And the last step is the one people skip: guards back on, machine checked, plugged back in only when it is fully reassembled.",
      ],
      bullets: [
        "Off, unplugged or isolated, plug in sight. Then hands.",
        "Gauge plate to zero and closed before cleaning a slicer.",
        "Clear jams isolated, with the tool, never with fingers.",
        "No water near switches, panels or motors.",
        "Guards back on before it goes back on the socket.",
      ],
      keyPoint:
        "The plug in your line of sight is the whole lesson. If you cannot see how the machine is isolated, assume it can start.",
    },
    {
      id: "ke-hot",
      title: "Hot kit, burns and scalds",
      body: [
        "Burns and scalds sit right behind cuts in kitchen injury figures, and this lesson is about the burn only. Ignition, extinguishers, extraction grease and evacuation are the fire safety awareness course and are not repeated here.",
        "Oil is the worst of it, because it holds far more heat than water and it sticks to skin. Never move a fryer, a pan of hot oil or a stockpot with oil in it. Never drain or filter a fryer until the oil is cool enough that the manufacturer says it is safe, and never over a bucket somebody can walk into. Water in hot oil erupts, so wet baskets, wet food and a wet ladle are all a spitting hazard.",
        "Hot liquid moves. Carrying a pot means using dry cloths, both hands, a clear route and saying \"hot behind\". Wet cloths conduct heat straight through to your palm and that is how people drop the pot they were being careful with. Pot handles turned in over the range get knocked; handles hanging over the edge get caught by the next person past. Neither is right — in over the hob, not over a walkway.",
        "Steam is the one people underestimate. Opening a combi or a lid tips a wall of steam onto your face and forearms, and steam scalds deeper than water at the same temperature. Crack it, let it clear, stand aside from the opening. Same with a dishwasher at the end of a cycle.",
        "Hot surfaces stay hot for a long time after they are switched off, and that is the burn nobody expects — a griddle at the end of the night, an oven rack, a bain-marie well, a coffee steam wand, the top of a salamander. If you did not switch it off yourself, treat it as hot.",
        "And the same rule as everything else in this course: hot oil, hot water and steam get cleaned when they are cool and the machine is isolated, not while service is still running and definitely not because it is quicker.",
      ],
      bullets: [
        "Never move hot oil. Cool it before draining or filtering.",
        "Water into hot oil erupts. Dry baskets, dry food, dry tools.",
        "Dry cloths, both hands, clear route, say it out loud.",
        "Handles in over the hob, never over a walkway.",
        "Crack lids and combi doors, let the steam clear, stand aside.",
        "Assume any surface you did not switch off yourself is still hot.",
      ],
      keyPoint:
        "Fire is the other course. Here, hot oil and steam are simply the two things in the building most likely to put somebody in a burns unit, and both are handled cool or not at all.",
    },
    registerLesson(assets),
    {
      id: "ke-report",
      title: "Reporting a fault, and why the record matters",
      body: [
        "A machine tells you it is going before it goes. A new noise, a smell of hot insulation, a guard that no longer sits properly, a lid that runs without being closed, a blade that has stopped biting, a plug or flex that gets warm, a unit that trips a breaker, a wobble that was not there last week. None of those are things to work around until the end of the week.",
        "The sequence is short. Stop using it. Isolate it. Label it so nobody else starts it — a note taped over the switch does the job. Tell a manager the same shift. And then it gets recorded on the register, because a spoken handover dies with the shift and the next person to touch that machine will not have been in the room.",
        "In Rotahr that record is the status on the item in Log book → Equipment: faulty, awaiting parts or out of service, then back to working once it is fixed. That is what makes \"do not use the slicer\" visible to somebody who starts at six tonight and never spoke to you. The same page holds the next service date, which is what makes the reminder fire before a guard check is overdue rather than after.",
        "Reporting is not admitting anything. Most faults are wear, not misuse, and a fault reported early is a service call while a fault worked around is a machine failing mid-service or a hand in a hospital. Nobody has ever been disciplined for a fault report that turned out to be nothing.",
        "Last thing, and it is the one this course cannot let go: never repair, re-guard or re-wire a machine yourself, and never sign off that somebody else's repair is safe. That is for the engineer or the competent person, and the whole reason the register exists is so that it happens.",
      ],
      bullets: [
        "Stop, isolate, label, tell a manager, record it.",
        "Status on the register is what tells the next shift, not your handover.",
        "A service date on the item is what makes the reminder fire.",
        "Early fault report is a service call; a worked-around fault is an injury.",
        "You never repair or re-guard it yourself.",
      ],
      keyPoint:
        "If the only place a fault exists is in your head, the person on tonight is going to use that machine. Write it down.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Knowledge bank
// --------------------------------------------------------------------------- //

function knifeEquipmentBank(): QuizQuestion[] {
  return [
    {
      id: "k-sharp",
      kind: "single",
      prompt: "Which knife is more likely to cut you, and why?",
      options: [
        "A sharp one, because it cuts more easily",
        "A blunt one, because it needs force and skids off what you are cutting",
        "They are the same as long as you concentrate",
        "Neither — it depends only on the board",
      ],
      correct: [1],
      why: "Blunt blades need pressure, pressure makes them skid, and a skidding blade under load goes wherever your other hand is. Sharp knives cut what they are aimed at.",
    },
    {
      id: "k-board",
      kind: "single",
      prompt: "Your cutting board slides on the bench while you are working. What do you do?",
      options: [
        "Work more slowly and hold it harder with the other hand",
        "Put a damp cloth or a mat under it before carrying on",
        "Ignore it, boards always slide a bit",
        "Move to the floor where it will not move",
      ],
      correct: [1],
      why: "A moving board is a knife going somewhere you did not aim it. A damp cloth or mat underneath takes ten seconds.",
    },
    {
      id: "k-catch",
      kind: "single",
      prompt: "A knife slides off the bench edge towards the floor. What is the right reaction?",
      options: [
        "Catch it by the handle if you can reach",
        "Trap it against your leg",
        "Step back and let it land, then pick it up",
        "Kick it clear of your feet",
      ],
      correct: [2],
      why: "Nobody catches a falling knife reliably. Step back, let it hit the floor, then pick it up by the handle.",
    },
    {
      id: "k-sink",
      kind: "single",
      prompt: "You have finished with a chef's knife but the pot wash is busy. What must not happen?",
      options: [
        "Washing it separately, blade away from your hand",
        "Leaving it in the sink or a bowl of water until somebody gets to it",
        "Drying it and putting it back in the block",
        "Putting it in a knife rack still dirty and telling the KP",
      ],
      correct: [1],
      why: "A knife under water or under a cloth is invisible, and the person washing up finds it with their hand. Wash knives separately, never leave them in a sink.",
    },
    {
      id: "k-walk",
      kind: "single",
      prompt: "You need to carry a knife across a busy kitchen. How?",
      options: [
        "Blade up in front of you so people can see it",
        "Point down, blade turned back, arm straight at your side, speak as you pass behind people",
        "Wrapped in a tea towel so nobody sees it",
        "On top of a tray of prep you are already carrying",
      ],
      correct: [1],
      why: "Point down, blade back, arm at your side, and say something as you pass. Never carry a knife along with something else.",
    },
    {
      id: "k-hand",
      kind: "single",
      prompt: "A colleague asks you to pass them the knife you are holding. What is the safe way?",
      options: [
        "Hold the blade and offer the handle to them",
        "Put it down on the bench with the handle towards them and let them pick it up",
        "Pass it handle first through the air, quickly",
        "Toss it onto their board",
      ],
      correct: [1],
      why: "Nobody hands a knife to anybody. Put it down on the bench, handle towards them, and let them take it.",
    },
    {
      id: "k-store",
      kind: "single",
      prompt: "Where do knives get stored at the end of a shift?",
      options: [
        "Loose in a drawer with the other utensils",
        "In a block, a rack, a sheath or a knife roll",
        "In the sink ready for the morning",
        "Blade down in a jug of sanitiser",
      ],
      correct: [1],
      why: "Loose in a drawer is how hands get cut reaching for a spoon. Block, rack, sheath or roll, clean and dry.",
    },
    {
      id: "k-wrongknife",
      kind: "single",
      prompt: "A delivery box is taped shut and your chef's knife is the nearest tool. What is wrong with using it?",
      options: [
        "Nothing, as long as you cut away from yourself",
        "It is the wrong tool — prising and stabbing snaps tips and skids off hard surfaces, and it blunts the blade you then cook with",
        "Only that the blade needs washing afterwards",
        "Nothing, boxes are softer than food",
      ],
      correct: [1],
      why: "A chef's knife is not a box cutter, a lever or a chisel. Wrong-tool use is a large share of kitchen cuts and it ruins the edge.",
    },
    {
      id: "k-mandolin",
      kind: "single",
      prompt: "You are down to the last third of a block of celeriac on the mandolin and the holder is awkward. What now?",
      options: [
        "Finish it by hand, carefully and slowly",
        "Use the holder or a cut-resistant glove, or stop and finish it with a knife",
        "Speed up so your hand spends less time near the blade",
        "Hold it with a folded tea towel",
      ],
      correct: [1],
      why: "The last third is exactly where mandolin injuries happen. Holder, cut-resistant glove, or finish it with a knife. There is no prize for the last few slices.",
    },
    {
      id: "k-guard",
      kind: "single",
      prompt: "Somebody has taken the guard off a machine because it is quicker to clean that way. What is the machine now?",
      options: [
        "Fine while everyone knows the guard is off",
        "Out of use until the guard is back on, and a manager needs to know",
        "Fine for experienced staff only",
        "Fine as long as it is only used during prep, not service",
      ],
      correct: [1],
      why: "The guard is why the machine is legal to sell. Without it the machine is out of use, and reporting that protects the next person, not you.",
    },
    {
      id: "k-interlock",
      kind: "multi",
      prompt: "Which of these count as defeating a machine's safety interlock?",
      note: "Select all that apply.",
      options: [
        "Taping down a lid switch so it runs with the lid open",
        "Wedging a bowl cage up with a folded cloth",
        "Closing the lid properly before starting it",
        "Holding a safety sensor closed with a magnet",
        "Waiting for the blade to stop before opening it",
      ],
      correct: [0, 1, 3],
      why: "Tape, wedges and magnets all turn a designed-safe machine into an open blade that runs while your hands are inside it. Closing the lid and waiting for the blade to stop are simply using it correctly.",
    },
    {
      id: "k-jam",
      kind: "single",
      prompt: "The mincer jams mid-batch. What is the first thing you do?",
      options: [
        "Reverse it and push the blockage through with your fingers",
        "Switch it off and clear it with the pusher",
        "Isolate it — off and unplugged or at the isolator — then clear it with the tool",
        "Hold the blockage back while a colleague runs it",
      ],
      correct: [2],
      why: "Off is a dial position; isolated means it cannot start. A screw feed or a stiff blade can move suddenly the moment the jam gives, so it has to be dead first and cleared with the tool.",
    },
    {
      id: "k-plug",
      kind: "single",
      prompt: "What is the difference between a machine that is off and a machine that is isolated?",
      options: [
        "None, they mean the same thing",
        "Off is a switch position; isolated means unplugged or off at the isolator so it cannot start whatever anybody presses",
        "Isolated just means the machine is cold",
        "Isolated means the manager has signed for it",
      ],
      correct: [1],
      why: "Nearly every serious machine injury happens during cleaning or unjamming on a machine that was off rather than isolated. Unplug it and keep the plug in sight.",
    },
    {
      id: "k-slicer",
      kind: "single",
      prompt: "You are cleaning the slicer after service. Which combination is right?",
      options: [
        "Gauge plate at the last setting used, machine off at the switch",
        "Gauge plate to zero and closed, machine isolated with the plug in sight",
        "Machine running slowly so the blade rinses evenly",
        "Blade removed first, then unplug it",
      ],
      correct: [1],
      why: "A slicer blade rim cuts just as well standing still. Zero the gauge plate, close it, isolate the machine, and only take the blade out if you have been shown how on that machine.",
    },
    {
      id: "k-loose",
      kind: "single",
      prompt: "Why do apron strings, sleeves, a shoulder cloth, a watch or a ring matter around a mixer?",
      options: [
        "They do not, only hair does",
        "The moving part catches the fabric or the metal first and pulls the hand in after it",
        "Only because they get dirty",
        "Only if the machine is running on its highest speed",
      ],
      correct: [1],
      why: "Entanglement is how a hand ends up somewhere no hand would ever be put deliberately. Nothing loose near a moving part.",
    },
    {
      id: "k-trained",
      kind: "single",
      prompt: "You have used a slicer at a previous job but nobody has shown you this one. Can you use it?",
      options: [
        "Yes, a slicer is a slicer",
        "No — being shown means somebody competent walking you through this specific machine",
        "Yes, if you go slowly the first time",
        "Yes, as long as a manager is somewhere in the building",
      ],
      correct: [1],
      why: "Controls, guards and interlocks differ between machines, and so does the cleaning strip-down. Instruction is per machine, not per machine type.",
    },
    {
      id: "k-oil",
      kind: "single",
      prompt: "The fryer needs draining and service starts in an hour. What is acceptable?",
      options: [
        "Drain it hot into a bucket to save time",
        "Carry it to the yard and empty it there",
        "Wait until the oil is cool enough that the manufacturer says it is safe, then drain it into the proper container on a clear route",
        "Drain it hot but put a wet cloth over the bucket",
      ],
      correct: [2],
      why: "Oil holds far more heat than water and sticks to skin. Never move hot oil and never rush the drain — a scald from fryer oil is a burns-unit injury.",
    },
    {
      id: "k-water-oil",
      kind: "single",
      prompt: "Why do wet baskets, wet food or a wet ladle matter at the fryer?",
      options: [
        "They cool the oil and waste gas",
        "Water hitting hot oil erupts, throwing oil out of the well",
        "They make the food soggy, that is all",
        "They do not matter once the oil is up to temperature",
      ],
      correct: [1],
      why: "Water flashing to steam under oil throws the oil out of the well and over whoever is standing there. Dry baskets, dry food, dry tools.",
    },
    {
      id: "k-cloth",
      kind: "single",
      prompt: "You need to move a hot pot across the kitchen. Which is right?",
      options: [
        "A damp cloth in one hand so it grips better",
        "Dry cloths, both hands, a clear route, and say \"hot behind\" as you go",
        "Oven gloves are enough on their own, route does not matter",
        "Ask somebody to walk in front and clear the way as you go",
      ],
      correct: [1],
      why: "A wet cloth conducts heat straight to your palm, which is how people drop the pot they were being careful with. Dry cloths, two hands, clear route, and warn people.",
    },
    {
      id: "k-steam",
      kind: "single",
      prompt: "You are opening a combi oven that has been running. What is the safe way?",
      options: [
        "Open it fully and step back once it is open",
        "Crack it, let the steam clear, and stand to the side of the opening",
        "Open it quickly so less steam escapes",
        "Open it with a wet cloth over your forearm",
      ],
      correct: [1],
      why: "Steam scalds deeper than water at the same temperature and it goes straight for the face and forearms. Crack, wait, stand aside.",
    },
    {
      id: "k-hotsurface",
      kind: "single",
      prompt: "The griddle was switched off at the end of service twenty minutes ago. How do you treat it?",
      options: [
        "As cold, it is off",
        "As hot — heavy surfaces hold heat long after the power is off, and if you did not switch it off yourself you do not know when it went off",
        "As hot only if you can still smell cooking",
        "As cold, but wear gloves anyway",
      ],
      correct: [1],
      why: "Griddles, oven racks, bain-marie wells, salamanders and steam wands stay dangerous for a long time after switch-off. Assume hot unless you switched it off yourself and know how long ago.",
    },
    {
      id: "k-report-faulty",
      kind: "single",
      prompt: "A machine has developed a new noise and the plug feels warm. It still works. What do you do?",
      options: [
        "Use it for tonight and mention it tomorrow",
        "Stop using it, isolate it, label it so nobody else starts it, tell a manager this shift and get it recorded",
        "Use it only for small batches until it fails",
        "Unplug it and say nothing until somebody notices",
      ],
      correct: [1],
      why: "A new noise and a warm plug are the machine telling you it is going. Stop, isolate, label, tell a manager, record it on the register.",
    },
    {
      id: "k-tag",
      kind: "single",
      prompt: "A machine has a note taped over its switch saying it is out of use, and service is slammed. What do you do?",
      options: [
        "Use it once, carefully, then put the note back",
        "Leave it alone and work around it, even if that slows service",
        "Take the note off and check whether it still works",
        "Use it if the person who wrote the note is not in today",
      ],
      correct: [1],
      why: "Out of use means out of use until somebody competent has repaired it and the record has been changed. A busy service is not a reason, it is when people get hurt.",
    },
    {
      id: "k-cut-food",
      kind: "single",
      prompt: "You cut your finger while prepping. Which set of actions is right?",
      options: [
        "Rinse it, carry on, and cover it at the end of the order",
        "Stop working, get anything the wound touched thrown away, cover it with a blue detectable dressing, and get it recorded — with anything beyond a minor nick handed to somebody trained in first aid",
        "Cover it with any plaster and keep going",
        "Wear a glove over it and finish the batch",
      ],
      correct: [1],
      why: "Stop, bin the affected food, blue detectable dressing, record it. Treatment itself is for somebody trained in first aid, which this course is not.",
    },
    {
      id: "k-repair",
      kind: "single",
      prompt: "Completing this course means you can do which of the following?",
      options: [
        "Repair and re-guard kitchen machinery yourself",
        "Give first aid to somebody who has been cut",
        "Sign off that somebody else's repair is safe",
        "Use the equipment you have been shown, isolate it before cleaning, and report faults properly",
      ],
      correct: [3],
      why: "This is in-house awareness training. It is not first aid, not engineer training, and not authority to repair, re-guard or sign off anything.",
    },
    {
      id: "k-clean-timing",
      kind: "single",
      prompt: "When does a machine with a blade get stripped and cleaned?",
      options: [
        "During service, between orders, to spread the work out",
        "When it is out of service, cool, isolated, by somebody who has been shown how on that machine",
        "Whenever it is quiet, running slowly so the blade rinses",
        "At the end of the week",
      ],
      correct: [1],
      why: "Cleaning and unjamming are when the injuries happen. Cool, isolated, not mid-service, and only by somebody shown how on that specific machine.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Questions built from the venue's own register
// --------------------------------------------------------------------------- //

export function knifeEquipmentAssetQuestions(
  assets: CourseAsset[],
  seed: number
): QuizQuestion[] {
  const live = assets.filter((a) => a.status !== "retired");
  const out: QuizQuestion[] = [];

  // Nothing recorded — the path most venues on the platform actually hit. Test
  // the instinct instead of the list, the way the fire course does.
  if (live.length === 0) {
    out.push({
      id: "kev-empty",
      kind: "single",
      prompt:
        "Your venue's equipment register has nothing recorded on it. What does that tell you about the machines in the building?",
      note: "This reflects your venue's own records.",
      options: [
        "There is nothing here with a blade or a moving part",
        "Nothing at all — a blank register only means nobody has written the equipment down yet",
        "The machines must all be new and under warranty",
        "Somebody has checked them and found no issues",
      ],
      correct: [1],
      why: "A blank record is never evidence of an absence. It means the walk has not been done and written up, so nothing is scheduled and nothing is chased.",
    });
    out.push({
      id: "kev-empty-why",
      kind: "single",
      prompt:
        "With no equipment recorded, how does the next shift find out that a machine has been taken out of use?",
      note: "This reflects your venue's own records.",
      options: [
        "From the register status, as normal",
        "Only if somebody happens to tell them in person, which is exactly the problem",
        "The machine locks itself out",
        "A service reminder goes out automatically",
      ],
      correct: [1],
      why: "Without a register the only handover is verbal, and it dies with the shift. That is why a fault gets recorded as well as reported, and why building the register is worth asking a manager for.",
    });
    return out;
  }

  const powered = live.filter((a) => HANDS_INSIDE_CATEGORIES.has(a.category));
  const inert = live.filter((a) => INERT_CATEGORIES.has(a.category));
  const outOfUse = live.filter((a) => OUT_OF_USE_STATUSES.has(a.status));
  const overdue = live.filter((a) => a.serviceOverdue);
  const noService = live.filter((a) => !a.nextServiceDate);
  const noLocation = live.filter((a) => !a.location);

  // 1. A unit recorded as not fit for use, by name.
  const broken = shuffled(outOfUse, seed + 3)[0];
  if (broken) {
    out.push({
      id: `kev-outofuse-${broken.id}`,
      kind: "single",
      prompt: `Your register records "${broken.name}" as ${statusLabel(
        broken.status
      )}. Service is busy and it appears to still run. What do you do?`,
      note: "This is your venue's own recorded equipment status.",
      options: [
        "Use it once and put it back to how you found it",
        "Leave it alone until somebody competent has repaired it and the record has been changed",
        "Use it only for small jobs",
        "Use it if nobody has explained why it was marked that way",
      ],
      correct: [1],
      why: "That status is an instruction, not a note. It exists so somebody who was never in the room can tell the machine is not to be used.",
    });
  }

  // 2. Which of our own items do you isolate before reaching inside? Only asked
  //    where the register genuinely holds both kinds, so the decoys are honest.
  if (powered.length > 0 && inert.length > 0) {
    const chosenPowered = shuffled(powered, seed + 5).slice(0, 3);
    const chosenInert = shuffled(inert, seed + 7).slice(
      0,
      Math.max(1, 5 - chosenPowered.length)
    );
    const optionAssets = shuffled([...chosenPowered, ...chosenInert], seed + 11);
    out.push({
      id: "kev-isolate",
      kind: "multi",
      prompt:
        "Which of these items from your own register have a moving part, a heated surface or a blade — so they get isolated, not just switched off, before you reach inside?",
      note: "Select all that apply. These are your venue's own recorded assets.",
      options: optionAssets.map((a) => label(a)),
      correct: optionAssets
        .map((a, i) => (HANDS_INSIDE_CATEGORIES.has(a.category) ? i : -1))
        .filter((i) => i >= 0),
      why: `Cooking, refrigeration, dishwashing, bar, coffee, extraction and electrical items all have a motor, a fan, an element or an edge. ${
        chosenInert.length === 1
          ? `${chosenInert[0].name} does not`
          : `${chosenInert.map((d) => d.name).join(" and ")} do not`
      }.`,
    });
  }

  // 3. A named machine, isolation before cleaning.
  const machine = shuffled(powered.length > 0 ? powered : live, seed + 13)[0];
  if (machine) {
    out.push({
      id: `kev-machine-${machine.id}`,
      kind: "single",
      prompt: `"${machine.name}"${
        machine.location ? ` in ${machine.location}` : ""
      } needs cleaning inside at the end of the night. What has to be true before your hands go in?`,
      note: "This is a piece of equipment recorded on your own register.",
      options: [
        "It is switched off at its own control",
        "It is off and unplugged, or off at the isolator, with the plug or isolator where you can see it, and it is cool",
        "Somebody is standing next to the switch",
        "It has been left for ten minutes",
      ],
      correct: [1],
      why: "Off is a switch position. Isolated means it cannot start whatever anybody presses or knocks, and the plug in your line of sight is the simplest lockout there is.",
    });
  }

  // 4. An overdue service, framed as the guard check nobody has done.
  const late = shuffled(overdue, seed + 17)[0];
  if (late) {
    out.push({
      id: `kev-overdue-${late.id}`,
      kind: "single",
      prompt: `Your register shows "${late.name}" was due a service on ${niceDate(
        late.nextServiceDate
      )}, which has passed. Why does that matter for safety rather than just paperwork?`,
      note: "This is your own recorded service date.",
      options: [
        "It does not — it only affects the warranty",
        "The service is the visit where guards, interlocks and worn parts get checked, so overdue means nobody has checked them",
        "It matters only once the machine stops working",
        "It matters only at the annual inspection",
      ],
      correct: [1],
      why: "On a machine with a guard or an interlock, the service is what proves the safety features still work. Overdue is worth telling a manager about.",
    });
  }

  // 5. No service date recorded on any of it — the shape most registers on the
  //    platform are actually in.
  if (noService.length > 0) {
    out.push({
      id: `kev-noservice-${noService.length}`,
      kind: "single",
      prompt:
        noService.length === live.length
          ? `None of the ${live.length} ${
              live.length === 1 ? "item" : "items"
            } on your register has a next service date recorded. What is the practical consequence?`
          : `${noService.length} of the ${live.length} items on your register have no next service date recorded. What is the practical consequence?`,
      note: "This reflects your venue's own records.",
      options: [
        "None — servicing happens when the machine breaks",
        "No reminder can fire for those items and nobody can tell from the record when guards or worn parts were last checked",
        "It means those items do not need servicing",
        "It only affects resale value",
      ],
      correct: [1],
      why: "A blank service date means nothing is scheduled and nothing gets chased. It is a quick fix for a manager and worth asking for.",
    });
  }

  // 6. No location recorded — matters the night somebody has to isolate fast.
  if (noLocation.length === live.length && live.length > 1) {
    out.push({
      id: `kev-nolocation-${live.length}`,
      kind: "single",
      prompt:
        "None of the items on your register have a location recorded against them. When does that actually bite?",
      note: "This reflects your venue's own records.",
      options: [
        "Never, everybody knows where things are",
        "When a machine has to be isolated fast, or when an engineer arrives and has to be walked round the building to find the unit they came for",
        "Only during a stock take",
        "Only if the venue has more than one floor",
      ],
      correct: [1],
      why: "A location field is worth nothing on a quiet day and worth a lot on the night somebody who has never worked here has to find the isolator.",
    });
  }

  return out;
}

/** The full knife and equipment paper: the venue's own register first, then knowledge. */
export function knifeEquipmentQuiz(assets: CourseAsset[], seed: number): QuizQuestion[] {
  const fromAssets = knifeEquipmentAssetQuestions(assets, seed);
  const wanted = 12;
  const knowledge = shuffled(knifeEquipmentBank(), seed).slice(
    0,
    Math.max(8, wanted - fromAssets.length)
  );
  return shuffled([...fromAssets, ...knowledge], seed + 29);
}
