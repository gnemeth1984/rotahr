/**
 * Guest data & privacy awareness — in-house course content.
 *
 * Same rules as every other course in this folder: employer-delivered awareness
 * training, never an accredited data protection qualification, and every legal
 * figure hedged. Privacy law is the most jurisdiction-dependent subject in the
 * library — the GDPR governs the EU and EEA, the UK has its own near-identical
 * regime, and the US, Canada and Australia are different again. So the copy
 * teaches the instinct and points at the local rule rather than stating one
 * deadline as if it were universal.
 *
 * One hard rule specific to this course: it reads the venue's CRM as SHAPE
 * ONLY — counts, flags, note lengths. No guest name, email, phone number,
 * allergy text or note text ever reaches a lesson or a question. A privacy
 * course that printed "Siobhán, SEVERE nut allergy" onto a page every member of
 * staff opens would be a breach in its own right, and the completion stores a
 * snapshot of what the course read, so that text would then live in the
 * evidence record forever. See CourseCustomer in kit.ts.
 */

import {
  type CourseCustomer,
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
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `about ${Math.round(d / 7)} weeks ago`;
  return `about ${Math.round(d / 30)} months ago`;
}

interface Shape {
  total: number;
  consent: number;
  noConsent: number;
  consentUndated: number;
  sms: number;
  email: number;
  phone: number;
  allergy: number;
  dietary: number;
  notes: number;
  longestNote: number;
  tagged: number;
  anonymised: number;
  oldest: string | null;
}

function shapeOf(customers: CourseCustomer[]): Shape {
  const consent = customers.filter((c) => c.consent);
  const sorted = [...customers].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  return {
    total: customers.length,
    consent: consent.length,
    noConsent: customers.length - consent.length,
    consentUndated: consent.filter((c) => !c.consentAt).length,
    sms: customers.filter((c) => c.smsConsent).length,
    email: customers.filter((c) => c.hasEmail).length,
    phone: customers.filter((c) => c.hasPhone).length,
    allergy: customers.filter((c) => c.hasAllergyData).length,
    dietary: customers.filter((c) => c.hasDietaryNotes).length,
    notes: customers.filter((c) => c.hasInternalNotes).length,
    longestNote: customers.reduce((m, c) => Math.max(m, c.noteLength), 0),
    tagged: customers.filter((c) => c.tagCount > 0).length,
    anonymised: customers.filter((c) => c.anonymised).length,
    oldest: sorted.length ? sorted[0].createdAt : null,
  };
}

// --------------------------------------------------------------------------- //
// Venue lessons — the venue's own CRM, read as shape
// --------------------------------------------------------------------------- //

export function crmLesson(customers: CourseCustomer[]): Lesson {
  const s = shapeOf(customers);

  if (s.total === 0) {
    return {
      id: "your-guest-records",
      title: "Your own guest records",
      body: [
        "There are no guest profiles saved at this venue yet. That is a genuinely clean position to be in, and it is worth understanding why before it changes.",
        "Guest data arrives quietly. The first booking with a phone number on it, the first note about a nut allergy, the first list of names for a Christmas party. Nobody decides to start holding personal data; it accumulates. By the time it is worth thinking about, there are usually a few hundred rows and nobody remembers who agreed to what.",
        "So the useful thing to take from this course is not a rule about a database you do not have. It is the habit: collect what the job actually needs, write down when somebody agreed to be contacted, and never type anything into a guest record you would not read out to that guest.",
      ],
      keyPoint:
        "The cheapest privacy position is the one you start with. Every field you never collect is a field you never have to protect, disclose or delete.",
    };
  }

  const body: string[] = [];

  body.push(
    `This venue holds ${s.total} guest ${plural(
      s.total,
      "profile",
      "profiles"
    )} — ${s.email} with an email address and ${s.phone} with a phone number. Every one of those is personal data about an identifiable living person, and the venue is responsible for all of it, whether it was typed in deliberately or built up automatically from bookings.`
  );

  if (s.oldest) {
    body.push(
      `The oldest profile was created ${agoPhrase(s.oldest)} (${niceDate(
        s.oldest
      )}). That matters more than it looks: a guest record does not become more valuable with age, it becomes more of a liability. Contact details go stale, the person may have no memory of the venue, and if the list is ever exposed, the size of the problem is measured by how much you kept, not how much you used.`
    );
  }

  if (s.noConsent > 0) {
    body.push(
      `${s.consent} of the ${s.total} profiles are marked as having given consent. ${
        s.noConsent
      } ${plural(s.noConsent, "is", "are")} not. Holding a profile without consent is not automatically wrong — a booking is generally handled on the basis of the reservation itself, not on marketing consent — but sending marketing to ${plural(
        s.noConsent,
        "that record",
        "those records"
      )} would be, and Rotahr's own email tool is deliberately gated on that flag for exactly that reason.`
    );
  } else {
    body.push(
      `All ${s.total} profiles are marked as having given consent, and ${
        s.total - s.consentUndated
      } of those carry the date it was given. The date is the part that matters if it is ever questioned: a tick with no date is an assertion, a tick with a date is a record.`
    );
  }

  if (s.consentUndated > 0) {
    body.push(
      `${s.consentUndated} ${plural(
        s.consentUndated,
        "profile is",
        "profiles are"
      )} marked as consented with no date recorded. If a guest ever asks what they agreed to and when, that is the field you would want to be able to point at.`
    );
  }

  body.push(
    `SMS and WhatsApp consent is recorded separately and is currently set on ${s.sms} of ${s.total}. That separation is deliberate. Somebody agreeing to be emailed has not agreed to a message on their phone, and in several regimes messaging a mobile is treated more strictly than email.`
  );

  if (s.allergy > 0 || s.dietary > 0) {
    body.push(
      `${s.allergy} ${plural(
        s.allergy,
        "profile carries",
        "profiles carry"
      )} allergy information and ${s.dietary} ${plural(
        s.dietary,
        "carries",
        "carry"
      )} dietary notes. That is health information about a named person. It is held for an obvious and good reason — it keeps somebody safe at the table — but it belongs in the guest record and the kitchen brief, not in a group email, a WhatsApp group or a conversation across a full dining room.`
    );
  }

  if (s.anonymised === 0) {
    body.push(
      `No profile has been anonymised yet. Rotahr has the function under CRM, and it exists because the correct answer to "please delete my details" is usually to strip the personal fields and keep the anonymous booking history, not to pretend the visit never happened.`
    );
  } else {
    body.push(
      `${s.anonymised} ${plural(
        s.anonymised,
        "profile has",
        "profiles have"
      )} been anonymised — the personal fields stripped, the booking history kept. That is what a properly handled erasure request looks like.`
    );
  }

  const bullets = [
    `${s.total} guest ${plural(s.total, "profile", "profiles")} held`,
    `${s.consent} consented${s.consentUndated ? `, ${s.consentUndated} without a date` : ""}`,
    `${s.sms} with SMS / WhatsApp consent`,
    `${s.allergy + s.dietary} carrying allergy or dietary information`,
    `${s.notes} carrying a free-text internal note`,
  ];

  return {
    id: "your-guest-records",
    title: "Your own guest records",
    body,
    bullets,
    keyPoint:
      "Every one of these rows is somebody who could ask, tomorrow, exactly what you hold about them and why. The answer should be boring.",
  };
}

export function notesLesson(customers: CourseCustomer[]): Lesson {
  const s = shapeOf(customers);

  if (s.total === 0) {
    return {
      id: "your-note-field",
      title: "The note field, before you have one",
      body: [
        "There are no guest profiles here yet, so there are no internal notes either. This lesson is the one worth remembering anyway, because the note field is where nearly every hospitality privacy problem actually starts.",
        "A guest profile has a free-text box on it. It is convenient, it is invisible in normal use, and it is where somebody eventually types a judgement rather than a fact. “Prefers the window table” is a fact. “Rude, watch him” is a judgement, and a guest is generally entitled to ask for a copy of what an organisation holds about them — including that box.",
        "The test is simple and it never changes: would you be comfortable if the guest read it back to you? If not, either it is not a fact, or it does not belong in the record.",
      ],
      keyPoint:
        "Write notes as if the guest will read them, because in most privacy regimes they are entitled to ask.",
    };
  }

  const body: string[] = [];

  if (s.notes === 0) {
    body.push(
      `None of the ${s.total} guest ${plural(
        s.total,
        "profile",
        "profiles"
      )} here carries a free-text internal note. That is unusually clean, and it is worth keeping that way on purpose rather than by accident.`
    );
    body.push(
      "The note box is where nearly every hospitality privacy problem starts. It is convenient, it is invisible in normal use, and it is where somebody eventually types a judgement rather than a fact. Tags and structured fields — regular, corporate, allergy — do the same job without inviting an opinion."
    );
  } else {
    body.push(
      `${s.notes} of the ${s.total} guest ${plural(
        s.total,
        "profile",
        "profiles"
      )} here ${plural(
        s.notes,
        "carries",
        "carry"
      )} a free-text internal note, and the longest runs to ${
        s.longestNote
      } characters. Nobody wrote those expecting an audience. That is exactly why they are worth a lesson.`
    );
    body.push(
      "A guest is generally entitled to ask an organisation for a copy of the personal data it holds about them, and in most regimes that includes the free-text box — not just the tidy fields. It does not matter that it was labelled internal. “Always books the window table, prefers French reds” reads perfectly well to the person it is about. “Difficult, argued about the bill” does not, and it is the kind of line that turns a routine request into a complaint."
    );
    body.push(
      "The other thing a note does is outlive its context. The person who wrote it knew what they meant. In two years, a new manager reads it flat, with no tone and no memory of the evening, and acts on it."
    );
  }

  if (s.tagged > 0) {
    body.push(
      `${s.tagged} ${plural(
        s.tagged,
        "profile is",
        "profiles are"
      )} tagged. Tags are the safer half of this: they are structured, they are consistent, and they are hard to write an opinion into. Where a tag can carry the meaning, use the tag rather than the sentence.`
    );
  }

  return {
    id: "your-note-field",
    title: "The note field",
    body,
    bullets: [
      "Facts about service, not judgements about people",
      "Assume the guest will read it — in most regimes they can ask",
      "Health and allergy details are for keeping somebody safe, not for colour",
      "Never a card number, never a document number, never a password",
      "A tag beats a sentence wherever a tag will do",
    ],
    keyPoint:
      "The note field is the one place in the CRM where staff, not the software, decide what gets recorded. That is where the training has to land.",
  };
}

// --------------------------------------------------------------------------- //
// Lessons
// --------------------------------------------------------------------------- //

export function privacyLessons(customers: CourseCustomer[]): Lesson[] {
  const knowledge: Lesson[] = [
    {
      id: "what-it-is",
      title: "What counts as personal data",
      body: [
        "Personal data is any information about an identifiable living person. Not just the obvious identifiers — anything that, alone or joined to something else, points at a particular human being.",
        "In a venue that is a much wider net than most staff assume. A booking name and a mobile number, obviously. But also the note that says a guest is coeliac, the tag that says VIP, the card receipt with the last four digits and the time, the CCTV frame at the door, the photograph of the table posted to social media, the WhatsApp thread where a name and an allergy were discussed, the rota and the payroll file — staff are people too, and their data is personal data on exactly the same terms.",
        "Two categories deserve extra care because they say something sensitive about the person: health information — allergies, intolerances, accessibility needs, anything about a medical condition — and anything revealing beliefs, ethnicity, politics or sexual orientation. Most privacy regimes treat those as a special class with a higher bar. A venue holds the first one routinely, because it has to.",
      ],
      bullets: [
        "Names, numbers, emails, addresses",
        "Allergies, intolerances, accessibility needs — health data",
        "Notes, tags, complaints, no-show history",
        "Card receipts, CCTV, photographs",
        "Staff records: rotas, wages, absences, certificates",
      ],
      keyPoint:
        "If a line of information points at one identifiable person, it is personal data — including the line somebody typed into a box marked internal.",
    },
    {
      id: "why-you-hold-it",
      title: "Why you are allowed to hold it",
      body: [
        "You need a reason to hold personal data, and “it is useful” is not one of them. In practice a venue relies on a small number of reasons and they are worth being able to tell apart, because they behave differently.",
        "Handling a booking — taking the name, the number, the party size, the allergy — is generally done because it is necessary to provide the service the guest asked for. Nobody needs to tick a marketing box to be allowed to book a table. Keeping records for tax, or a food safety record, is generally done because the law requires it. Neither of those depends on consent, and neither of them entitles you to email that guest an offer.",
        "Marketing is the one that does usually depend on permission, and the rules vary by country and by channel: email is treated differently from SMS, and an existing customer is often treated differently from a stranger. Rotahr therefore gates its guest email on the consent flag rather than trying to guess, and records the date the flag was set.",
        "The practical consequence is the one to remember: the basis you collected the data on limits what you can do with it later. Data taken to run a booking cannot quietly become a marketing list.",
      ],
      keyPoint:
        "Collected for a booking means usable for the booking. A new purpose needs its own justification, not a shrug.",
    },
    {
      id: "minimise",
      title: "Collect less than you could",
      body: [
        "The strongest privacy control in a hospitality business is not a policy. It is not collecting things.",
        "Every extra field is a field to keep accurate, a field to hand over when somebody asks what you hold, a field to delete when they ask you to, and a field that appears in the incident report if the system is ever breached. A birthday collected “in case we do something for regulars” that nothing has ever been done with is pure liability.",
        "The same applies to how long you keep it. An eight-year-old contact list that nobody has emailed in six years is not an asset — half the addresses are dead, several of those people have moved on entirely, and if it leaks, the venue answers for all of it.",
        "So the two questions are: do we need this field to do the job, and do we still need this row at all? Retention periods vary by country and by record type — employment and tax records usually have their own minimum periods — so set them against your local rules rather than by feel, write them down, and actually apply them.",
      ],
      bullets: [
        "Ask what the field is for before adding it",
        "Do not collect a date of birth without a reason",
        "Delete or anonymise what the business no longer needs",
        "Employment and tax records have their own retention periods — check locally",
        "An old marketing list is a liability, not an asset",
      ],
      keyPoint:
        "You cannot lose, leak or be asked to delete data you never collected.",
    },
    {
      id: "guest-rights",
      title: "What a guest can ask you for",
      body: [
        "Across the EU and EEA under the GDPR, in the UK under its equivalent regime, and in a growing number of other jurisdictions with their own variations, an individual has rights over the data an organisation holds about them. The exact list and the deadlines differ, so treat the shape as the lesson and the local rule as the detail.",
        "In broad terms, a person can ask what you hold about them and get a copy; ask you to correct something wrong; ask you to delete it, subject to records you are legally required to keep; ask you to stop using it for marketing, which is close to absolute; and ask you not to be subject to a purely automated decision about them.",
        "There is normally a deadline measured in weeks — one month is the common European figure, extendable in complex cases — and it usually starts the moment the request is made, in whatever form it was made. That is the part that catches venues out. A request does not have to be a formal letter to a legal address. “Can you send me everything you have on me?” said to a member of staff on a Friday night is the request, and the clock starts then.",
        "So the frontline job is not to answer it. It is to recognise it and pass it on the same day, to whoever handles it. Nothing about a request should be argued with at the door, and nothing should be deleted in a hurry to make it easier.",
      ],
      bullets: [
        "A copy of what you hold, and why you hold it",
        "Correction of anything inaccurate",
        "Deletion, unless a law requires the record to be kept",
        "An absolute-in-practice right to be taken off marketing",
        "Recognise it, log the date, escalate it the same day",
      ],
      keyPoint:
        "You are not expected to handle the request. You are expected to notice it and pass it on immediately — because the deadline starts when it is said, not when it reaches a manager.",
    },
    {
      id: "notes-disclosable",
      title: "The note is part of the record",
      body: [
        "This is the single most useful thing in the course for anybody who touches a guest profile, so it gets its own lesson.",
        "When a guest asks for a copy of what you hold about them, the answer is generally not limited to the tidy fields. Free-text notes about that person are usually personal data too, and usually disclosable. Labelling a box “internal” changes nothing about that.",
        "The consequences are practical rather than dramatic. A note reading “nut allergy, always confirm with kitchen” reads fine — it is a service fact and it is there to protect the guest. A note reading “awkward, complained for a free dessert” reads very differently in a printout, and a venue that has to hand that over has turned a routine administrative request into a complaint and possibly a story.",
        "Notes also outlive their author. The person who wrote it remembered the evening. The manager reading it two years later does not, and treats it as a standing fact about a human being.",
      ],
      keyPoint:
        "Write every guest note as if it will be read back to the guest by somebody who was not there. That is the realistic worst case, and it is also just good record-keeping.",
    },
    {
      id: "sharing",
      title: "Sharing it, and who else is holding it",
      body: [
        "Guest data leaves a venue more often than anybody intends. The booking platform, the payment provider, the marketing tool, the accountant, the delivery aggregator, the staff WhatsApp group where a list of names for a party gets pasted at 6pm.",
        "The formal side of that is the venue's job, not the frontline's: knowing which suppliers process guest data, having a proper agreement with them, and not signing up to a new tool that swallows the guest list because it was free. Adding a new app that syncs the customer list is a decision with legal weight, not an afternoon experiment.",
        "The frontline side is simpler and it is where things actually go wrong. Do not move guest data into personal channels. A personal phone, a personal email, a personal notebook, a group chat that includes people who have left — all of them take data out of the system, out of any retention rule, and out of any deletion request the venue later has to honour.",
        "And treat other guests as third parties. Confirming to a caller that somebody has a booking, or was in last Friday, is a disclosure. So is reading a booking list out loud at a busy pass.",
      ],
      bullets: [
        "Guest data stays in the venue's systems, not personal ones",
        "No guest lists in personal WhatsApp or personal email",
        "New tools that sync the guest list need a decision, not an experiment",
        "Never confirm whether somebody has a booking to a caller",
        "Allergy details go to the kitchen, not across the room",
      ],
      keyPoint:
        "Every copy you make somewhere unofficial is a copy nobody can delete, secure or account for later.",
    },
    {
      id: "breach",
      title: "When it goes wrong, speed is the whole game",
      body: [
        "A personal data breach is not only a hacker. It is a laptop left in a car, a phone with the booking app on it lost on a night out, an email with the whole guest list in the To field instead of blind copy, a printed function sheet left on a table, a former employee whose access was never removed, a spreadsheet sent to the wrong supplier.",
        "The rules on reporting vary and the numbers are jurisdiction-specific: in the EU and EEA, and similarly in the UK, a breach that is likely to result in a risk to people generally has to be reported to the supervisory authority without undue delay and in any event within 72 hours, with the affected people told directly where the risk is high. Other countries set different clocks, and some sectors have their own. Check your own before you need to.",
        "What that means on the floor is one thing only: escalate immediately. Not after a look around for the phone, not at the end of shift, not on Monday. The venue cannot start a clock it does not know about, and almost every case that turns into a penalty involves a delay that could have been avoided by telling somebody straight away.",
        "Then write down what happened and when, even if it turns out to be nothing. A breach log is expected in most regimes, including for the ones judged not reportable.",
      ],
      bullets: [
        "Lost phone or laptop with access to guest data — that is a breach",
        "Guest list emailed with visible addresses — that is a breach",
        "Escalate the same hour, not the same week",
        "Deadlines vary: 72 hours is the common European figure, not a universal one",
        "Log it even when the answer is that no report was needed",
      ],
      keyPoint:
        "Nobody is disciplined for reporting a lost phone. The damage is always done by the hours between the loss and somebody being told.",
    },
    {
      id: "practical",
      title: "The things that actually happen",
      body: [
        "Most of the risk in a venue is not exotic. It is a short list of ordinary situations, and knowing the answer in advance is the whole point of the training.",
        "Card details. Never write a full card number anywhere — not on a function sheet, not in a booking note, not in a message. Take card security from the payment provider's rules; the venue's own systems should never be holding the number at all.",
        "Photographs and social media. A photo of a busy room with identifiable faces is personal data, and posting a photo of a guest's celebration because it looked good is a decision to publish information about them. Ask.",
        "CCTV. It is a recording of identifiable people, it usually has to be signposted, and footage requests — from a guest, from a member of staff, from the police — go to a manager, not to whoever happens to know the password.",
        "Screens and paper. A booking screen facing the room, a function sheet left on the bar, a printed rota with phone numbers on it in a public corridor. Turn the screen, take the paper.",
        "Passwords and access. Shared logins make it impossible to say who looked at what, and someone who leaves should lose access that week, not eventually.",
      ],
      bullets: [
        "Full card numbers: nowhere, ever, in any note or message",
        "Photographs of identifiable guests: ask first",
        "CCTV requests: manager only",
        "Screens turned away from the room, paper not left out",
        "No shared logins; access removed when somebody leaves",
      ],
      keyPoint:
        "Almost every real incident is one of these six, and every one of them is prevented by a habit rather than a policy.",
    },
  ];

  // The venue's own records go last: principle first, then their own CRM read
  // back against it.
  return [...knowledge, crmLesson(customers), notesLesson(customers)];
}

// --------------------------------------------------------------------------- //
// Knowledge bank
// --------------------------------------------------------------------------- //

export function privacyBank(): QuizQuestion[] {
  return [
    {
      id: "p-what-counts",
      kind: "multi",
      prompt: "Which of these count as personal data in a venue? Select all that apply.",
      options: [
        "A booking note saying a guest is coeliac",
        "A CCTV recording of the front door",
        "The staff rota with phone numbers on it",
        "Total covers served last Saturday",
      ],
      correct: [0, 1, 2],
      why: "Anything pointing at an identifiable person counts — guests and staff alike. A total with no names attached does not.",
    },
    {
      id: "p-health",
      kind: "single",
      prompt: "A guest tells you they are severely allergic to nuts. How should that be treated?",
      options: [
        "As ordinary booking information, no different from a seating preference",
        "As health information: record it because it keeps them safe, keep it to the people who need it, and do not repeat it socially",
        "It should not be recorded at all, to be safe",
        "It can be shared freely because it is a safety matter",
      ],
      correct: [1],
      why: "It has to be recorded — the kitchen needs it. What makes it sensitive is who else gets to hear it. Both halves matter.",
    },
    {
      id: "p-basis-booking",
      kind: "single",
      prompt:
        "Does a venue need marketing consent from a guest before it can hold their name and phone number to run their booking?",
      options: [
        "Yes — consent is always required before holding any personal data",
        "No. Handling the booking is generally its own justification; marketing consent is a separate question about contacting them later",
        "Only if the booking is for more than six people",
        "Only if the guest asks about it",
      ],
      correct: [1],
      why: "Two different things. Running the service you were asked for is not the same permission as selling to them afterwards.",
    },
    {
      id: "p-purpose-creep",
      kind: "single",
      prompt:
        "You have 400 phone numbers collected purely to confirm bookings. Marketing wants to text them an offer. What is the position?",
      options: [
        "Fine — the venue collected them legitimately",
        "Not fine on that basis alone: the numbers were taken to run bookings, and marketing by text is a separate purpose with its own rules",
        "Fine as long as the text includes an opt-out",
        "Fine because they are existing customers",
      ],
      correct: [1],
      why: "This is the most common real-world breach in hospitality, and it never feels like one. The basis you collected on limits what you may do next.",
    },
    {
      id: "p-sms-separate",
      kind: "single",
      prompt:
        "A guest ticked the box agreeing to email offers. Does that cover an SMS or WhatsApp message?",
      options: [
        "Yes, marketing consent is marketing consent",
        "No — channels are treated separately, and messaging a mobile is often held to a stricter standard than email",
        "Yes, as long as the message is short",
        "Only for guests who have visited more than once",
      ],
      correct: [1],
      why: "That is exactly why Rotahr records SMS/WhatsApp consent as its own field rather than folding it into the general flag.",
    },
    {
      id: "p-notes-disclosable",
      kind: "single",
      prompt:
        "A guest asks for a copy of everything the venue holds about them. Does the internal note on their profile have to be included?",
      options: [
        "No — it is marked internal, so it is exempt",
        "Generally yes: a free-text note about that person is their personal data too, and labelling the box internal does not change it",
        "Only if the note mentions their health",
        "Only if the venue chooses to share it",
      ],
      correct: [1],
      why: "The single most useful fact in this course. Write every note expecting the guest to read it.",
    },
    {
      id: "p-note-wording",
      kind: "single",
      prompt: "Which of these belongs in a guest note?",
      options: [
        "“Awkward — complained last time, watch him”",
        "“Prefers the window table; coeliac — kitchen briefed each visit”",
        "“Paid with Visa ending 4471, expiry 09/28”",
        "“Thinks he owns the place”",
      ],
      correct: [1],
      why: "Service facts, not judgements, and never card details. The other three are all things a venue has actually had to hand over.",
    },
    {
      id: "p-request-form",
      kind: "single",
      prompt:
        "A guest says at the bar: “I want a copy of everything you hold on me.” What has just happened?",
      options: [
        "Nothing formal — they have to write to the company address",
        "A request has been made. It counts however it was made, the clock starts now, and it should be passed on the same day",
        "Nothing until they put it in writing and prove their identity",
        "It can be dealt with next time they visit",
      ],
      correct: [1],
      why: "No form is required. Frontline staff are not expected to answer it — only to recognise it and escalate it immediately.",
    },
    {
      id: "p-deadline",
      kind: "single",
      prompt: "How long does an organisation typically have to answer such a request?",
      options: [
        "24 hours",
        "Weeks rather than months — one month is the common European figure, extendable in complex cases, and other regimes set their own",
        "A year",
        "There is no time limit",
      ],
      correct: [1],
      why: "The exact deadline is jurisdiction-specific. What is universal is that it starts when the request is made, not when it reaches the right desk.",
    },
    {
      id: "p-erasure",
      kind: "single",
      prompt:
        "A guest asks to be deleted, but the venue must keep some transaction records for tax. What is the correct answer?",
      options: [
        "Refuse the request — the records have to be kept",
        "Delete everything immediately, including the transaction records",
        "Remove or anonymise the personal details, keep only what a law requires you to keep, and tell the guest what was kept and why",
        "Just take them off the mailing list and say nothing",
      ],
      correct: [2],
      why: "Erasure is not absolute, but neither is the excuse. The usual answer is anonymise the person and keep the minimum the law requires.",
    },
    {
      id: "p-anonymise",
      kind: "single",
      prompt: "What does properly anonymising a guest record mean?",
      options: [
        "Changing their name to “Guest” but keeping the email and phone",
        "Stripping the identifying details so the row can no longer be linked back to a person, while the anonymous visit history can remain",
        "Deleting the whole booking history so the visits never happened",
        "Hiding the profile from the list but keeping it intact",
      ],
      correct: [1],
      why: "Hidden is not deleted. If the record can still be traced back to the person, nothing has been anonymised.",
    },
    {
      id: "p-retention",
      kind: "single",
      prompt:
        "The venue has a marketing list of 4,000 addresses collected over eight years, unused for the last six. What is it?",
      options: [
        "An asset worth reactivating",
        "A liability: mostly dead addresses, no current basis for contacting them, and a breach involving all 4,000 if it leaks",
        "Harmless as long as nobody emails it",
        "Fine because they consented at the time",
      ],
      correct: [1],
      why: "Old data does not sit still and stay neutral. It ages into risk while doing nothing useful.",
    },
    {
      id: "p-minimise",
      kind: "single",
      prompt:
        "Somebody suggests adding a date-of-birth field to every guest profile, in case the venue does something for birthdays one day.",
      options: [
        "Add it — more information is always useful",
        "Do not add it until there is an actual use: an unused field is something to keep accurate, disclose, delete and report on if breached",
        "Add it but make it optional, which removes the issue",
        "Add it and decide later whether to use it",
      ],
      correct: [1],
      why: "Data minimisation is the cheapest control there is, and the only one that works by doing nothing.",
    },
    {
      id: "p-third-party",
      kind: "single",
      prompt:
        "Somebody phones and asks whether a named person has a table booked tonight. What do you do?",
      options: [
        "Confirm it — booking details are not sensitive",
        "Neither confirm nor deny that any named person has a booking; take a message if appropriate and pass it to a manager",
        "Confirm it only if the caller says they are family",
        "Confirm it but do not give the time",
      ],
      correct: [1],
      why: "Confirming a booking exists is a disclosure about that guest, and venues have been used this way to trace people who did not want to be found.",
    },
    {
      id: "p-whatsapp",
      kind: "single",
      prompt:
        "A function organiser sends a list of 30 guest names and dietary requirements. Where should it live?",
      options: [
        "Pasted into the staff WhatsApp group so everybody has it",
        "In the venue's own system, with the kitchen given what it needs — not copied into personal chats or personal phones",
        "Printed and left on the bar for the shift",
        "Forwarded to whoever is working, on their personal email",
      ],
      correct: [1],
      why: "Every unofficial copy escapes retention, security and any later deletion request. Group chats are the worst offender because they outlast the staff in them.",
    },
    {
      id: "p-cards",
      kind: "single",
      prompt: "Where is it acceptable to write down a guest's full card number?",
      options: [
        "On the function sheet, so the deposit can be taken later",
        "In the booking note, for convenience",
        "Nowhere. Card details go through the payment provider, and the venue should never be holding the number",
        "In a locked drawer at the back",
      ],
      correct: [2],
      why: "Card data carries its own industry rules on top of privacy law, and a venue almost never has a reason to hold a number at all.",
    },
    {
      id: "p-photos",
      kind: "single",
      prompt:
        "A guest's birthday table looks great and somebody wants to post the photo on the venue's social media. What is required?",
      options: [
        "Nothing — they are in a public place",
        "Ask the people who are identifiable in it, before posting",
        "Nothing, as long as no names are used",
        "Nothing, as long as the post is deleted after 24 hours",
      ],
      correct: [1],
      why: "Publishing an identifiable person's image is a decision about their data. Asking takes ten seconds and settles it.",
    },
    {
      id: "p-cctv",
      kind: "single",
      prompt:
        "A member of staff asks to see CCTV footage of an incident involving them. Who deals with that?",
      options: [
        "Whoever has the CCTV password, straight away",
        "A manager — footage requests are handled through the proper route, and footage usually shows other people too",
        "Nobody: CCTV is never disclosable",
        "The staff member can review it alone",
      ],
      correct: [1],
      why: "Footage often contains other identifiable people, so it is handled deliberately, not by whoever knows the login.",
    },
    {
      id: "p-breach-what",
      kind: "multi",
      prompt: "Which of these are personal data breaches? Select all that apply.",
      options: [
        "A phone with the booking app on it is lost on a night out",
        "An email offer is sent with 200 guest addresses visible in the To field",
        "A printed function sheet with names and allergies is left on a table",
        "A guest complains about the food on social media",
      ],
      correct: [0, 1, 2],
      why: "Loss and accidental disclosure are breaches just as much as hacking. A public complaint is not one — the guest published it themselves.",
    },
    {
      id: "p-breach-speed",
      kind: "single",
      prompt:
        "You realise at 9pm that the guest list was emailed to the wrong supplier this morning. What do you do?",
      options: [
        "Tell the manager first thing on the next shift",
        "Tell whoever is responsible immediately, tonight, and write down what happened and when",
        "Email the supplier asking them to delete it and leave it there",
        "Nothing — it was an honest mistake and it was only one email",
      ],
      correct: [1],
      why: "Asking for deletion is worth doing, but it is not a substitute for escalating. The venue cannot start a clock it does not know about.",
    },
    {
      id: "p-breach-clock",
      kind: "single",
      prompt: "Which statement about breach reporting deadlines is accurate?",
      options: [
        "Every country requires notification within 72 hours",
        "In the EU/EEA and similarly in the UK, a risky breach generally has to be reported without undue delay and within 72 hours; other regimes set their own rules, so check locally",
        "There is never any obligation to report a breach",
        "Reporting is only required if money was lost",
      ],
      correct: [1],
      why: "72 hours is a widely quoted European figure, not a global one. Never quote it as universal.",
    },
    {
      id: "p-staff-data",
      kind: "single",
      prompt: "Is a member of staff's data covered by the same thinking as a guest's?",
      options: [
        "No — employment records are outside privacy law",
        "Yes. Rotas, wages, absence records, certificates and disciplinary notes are all personal data, and staff have rights over them too",
        "Only after they leave",
        "Only for salaried staff",
      ],
      correct: [1],
      why: "Staff data is usually the more sensitive half of what a venue holds, and it is the half most often left on a printer.",
    },
    {
      id: "p-access-control",
      kind: "single",
      prompt: "Why do shared logins matter for privacy rather than just security?",
      options: [
        "They do not — a login is a login",
        "Because with a shared account nobody can say who looked at, changed or exported a guest's data, so the venue cannot answer for it afterwards",
        "Because they are harder to remember",
        "Because they slow down service",
      ],
      correct: [1],
      why: "Accountability is the point. “Somebody on the shared account” is not an answer to a guest asking who accessed their record.",
    },
    {
      id: "p-leaver",
      kind: "single",
      prompt: "A member of staff leaves. When should their access to guest data be removed?",
      options: [
        "Within the week of leaving at the latest, along with any shared passwords they knew",
        "Whenever somebody gets around to it",
        "Only if they left on bad terms",
        "Never — old accounts are useful for history",
      ],
      correct: [0],
      why: "A live account belonging to somebody who no longer works there is a standing breach waiting to happen, regardless of how they left.",
    },
    {
      id: "p-screens",
      kind: "single",
      prompt:
        "The booking screen at the host desk faces the room, showing tonight's names, numbers and notes. What is the issue?",
      options: [
        "None — it is only visible for a moment",
        "It discloses other guests' details to anybody standing at the desk, including the allergy and internal notes",
        "It is only a problem if the venue is busy",
        "It is fine because the screen is small",
      ],
      correct: [1],
      why: "The most common everyday disclosure in hospitality, and the easiest to fix: turn the screen.",
    },
    {
      id: "p-policy-vs-habit",
      kind: "single",
      prompt: "What does a written privacy policy on the website actually achieve on its own?",
      options: [
        "It makes the venue compliant",
        "It tells people what you do with their data — but compliance is what staff actually do at the desk, in the notes and in the group chat",
        "Nothing at all; it is decoration",
        "It transfers responsibility to the guest",
      ],
      correct: [1],
      why: "A policy nobody follows is evidence against you, not protection. The habits are the compliance.",
    },
  ];
}

// --------------------------------------------------------------------------- //
// Venue questions — built from the venue's own CRM shape, never its content
// --------------------------------------------------------------------------- //

export function customerQuestions(
  customers: CourseCustomer[],
  seed: number
): QuizQuestion[] {
  if (customers.length === 0) {
    return [
      {
        id: "p-empty",
        kind: "single",
        prompt:
          "This venue has no guest profiles saved yet. What is the right way to think about that?",
        options: [
          "Privacy rules do not apply here",
          "It is the cleanest position there is — and the habits set now decide what the list looks like once it starts filling up",
          "The venue should start collecting guest data to be competitive",
          "It means the training is irrelevant",
        ],
        correct: [1],
        why: "Guest data accumulates rather than being decided on. The habits are set before the list exists, or they are set badly afterwards.",
      },
      {
        id: "p-empty-why",
        kind: "single",
        prompt:
          "Bookings are taken here, so some personal data passes through even with no saved profiles. What does that mean in practice?",
        options: [
          "Nothing — if it is not saved in a CRM, it is not personal data",
          "A name and a number taken for a booking is personal data while you hold it, however briefly, and it still should not end up in a personal phone or a group chat",
          "It only counts once there are more than 100 guests",
          "It only matters for marketing",
        ],
        correct: [1],
        why: "Where the data is stored changes who can delete it later. It never changes what it is.",
      },
    ];
  }

  const out: QuizQuestion[] = [];
  const s = shapeOf(customers);

  // 1. The consent gap, asked as a judgement rather than a violation. Holding a
  //    profile without consent is legitimate; marketing to it is not.
  if (s.noConsent > 0) {
    out.push({
      id: `p-consent-gap-${s.total}`,
      kind: "single",
      prompt: `Of the ${s.total} guest ${plural(
        s.total,
        "profile",
        "profiles"
      )} saved here, ${s.consent} ${plural(
        s.consent,
        "is",
        "are"
      )} marked as consented and ${s.noConsent} ${plural(
        s.noConsent,
        "is",
        "are"
      )} not. What follows from that?`,
      options: [
        `The ${s.noConsent} unconsented ${plural(
          s.noConsent,
          "profile",
          "profiles"
        )} should be deleted immediately`,
        `Holding them is generally fine — a booking justifies itself — but they must not be sent marketing, which is why Rotahr's guest email is gated on that flag`,
        "Consent can be assumed for anybody who has visited more than once",
        "The flag is only relevant to guests who asked about it",
      ],
      correct: [1],
      why: "Two different questions. Holding a booking record and marketing to it are not the same permission, and the flag is what separates them.",
    });
  } else {
    out.push({
      id: `p-consent-all-${s.total}`,
      kind: "single",
      prompt: `All ${s.total} guest ${plural(
        s.total,
        "profile",
        "profiles"
      )} here are marked as consented. Which part of that record matters most if it is ever questioned?`,
      options: [
        "That the box is ticked",
        "The date it was given, and what they were told they were agreeing to — a tick with no date is an assertion, not a record",
        "That the guest has visited recently",
        "That the venue has a privacy policy on its website",
      ],
      correct: [1],
      why: "A flag on its own proves nothing about when or to what. The date is the evidence.",
    });
  }

  // 2. The note field, counted. The strongest venue question available, because
  //    the count is theirs and the answer is a habit.
  if (s.notes > 0) {
    out.push({
      id: `p-notes-${s.notes}-of-${s.total}`,
      kind: "single",
      prompt: `${s.notes} of the ${s.total} guest ${plural(
        s.total,
        "profile",
        "profiles"
      )} here ${plural(
        s.notes,
        "carries",
        "carry"
      )} a free-text internal note (the longest is ${
        s.longestNote
      } characters). If one of those guests asked for a copy of everything held about them, what happens to those notes?`,
      options: [
        "They stay internal — that is what the label means",
        "They are generally part of that guest's personal data and usually have to be included, exactly as written",
        "They only have to be included if the guest names the note",
        "They can be edited first to remove anything awkward",
      ],
      correct: [1],
      why: "And editing them after a request is made is far worse than the original note. Write them as if they will be read back.",
    });
  } else {
    out.push({
      id: `p-notes-none-${s.total}`,
      kind: "single",
      prompt: `None of the ${s.total} guest ${plural(
        s.total,
        "profile",
        "profiles"
      )} here carries a free-text internal note. What is the best way to keep it that way as the list grows?`,
      options: [
        "Ban notes entirely, whatever the situation",
        "Use structured tags and fields wherever they can carry the meaning, and keep any note to service facts",
        "Keep the notes somewhere else, like a personal phone",
        "It does not matter — notes are internal anyway",
      ],
      correct: [1],
      why: "Tags are hard to write an opinion into. A personal phone is the worst possible answer: it takes the data out of every rule the venue has.",
    });
  }

  // 3. Health data actually present in their own records.
  if (s.allergy + s.dietary > 0) {
    const n = s.allergy + s.dietary;
    out.push({
      id: `p-health-${n}`,
      kind: "single",
      prompt: `${n} guest ${plural(
        n,
        "profile",
        "profiles"
      )} here carries allergy or dietary information. How should that be handled?`,
      options: [
        "Deleted — it is health data and too risky to hold",
        "Kept, because the kitchen needs it to keep somebody safe, and limited to the people doing the job — not repeated socially or across the room",
        "Shared with all staff on every shift so nobody is caught out",
        "Moved into the booking name so it cannot be missed",
      ],
      correct: [1],
      why: "Both halves. Deleting it puts a guest at risk; broadcasting it exposes their health information to people with no need for it.",
    });
  }

  // 4. SMS consent as a separate permission — currently zero at every venue
  //    surveyed, which makes this a real question rather than a hypothetical.
  if (s.sms < s.total) {
    out.push({
      id: `p-sms-${s.sms}-of-${s.total}`,
      kind: "single",
      prompt: `SMS and WhatsApp consent is recorded separately here and is set on ${
        s.sms
      } of ${s.total} ${plural(s.total, "profile", "profiles")}. Why is it a separate field?`,
      options: [
        "Because texting costs money",
        "Because agreeing to email is not agreeing to a message on your phone, and messaging a mobile is often held to a stricter standard",
        "Because SMS is less private than email",
        "It is separate for no particular reason",
      ],
      correct: [1],
      why: "Treating one tick as permission for every channel is the classic mistake, and the one most likely to generate a complaint.",
    });
  }

  // 5. Age of the oldest record — retention, asked against their own timeline.
  if (s.oldest && daysAgo(s.oldest) >= 60) {
    out.push({
      id: `p-retention-own-${daysAgo(s.oldest)}`,
      kind: "single",
      prompt: `The oldest guest profile here was created ${agoPhrase(
        s.oldest
      )}. What should happen to guest records as they age?`,
      options: [
        "Nothing — keep everything forever in case it is useful",
        "They should be reviewed against a written retention period and deleted or anonymised when the business no longer needs them",
        "They should be deleted after exactly one year, everywhere",
        "They should be moved to a spreadsheet for safekeeping",
      ],
      correct: [1],
      why: "There is no single universal period — employment and tax records have their own minimums. What matters is having a rule and applying it.",
    });
  }

  return shuffled(out, seed + 13);
}

/**
 * Build the paper. Venue questions first, then knowledge to a floor of 8, and
 * top up to 12 — same shape as every other course in the library.
 */
export function privacyQuiz(customers: CourseCustomer[], seed: number): QuizQuestion[] {
  const mine = customerQuestions(customers, seed);
  const wanted = 12;
  const knowledge = shuffled(privacyBank(), seed).slice(
    0,
    Math.max(8, wanted - mine.length)
  );
  return shuffled([...mine, ...knowledge], seed + 37);
}
