import type { FreeTemplate } from "../types";

export const hotelTemplates: FreeTemplate[] = [
  {
    slug: "housekeeping-room-checklist",
    category: "hotel",
    name: "Housekeeping room checklist",
    h1: "Free housekeeping room checklist template",
    title: "Free Housekeeping Room Checklist Template | Rotahr",
    metaDescription:
      "Free housekeeping room checklist template for hotels and guesthouses. Printable PDF and Excel, room by room, with departure and stayover columns and a supervisor check.",
    answer:
      "This free housekeeping room checklist template — printable PDF or editable Excel — covers a room in the order you clean it, distinguishes departure from stayover service, and ends with a supervisor spot-check line.",
    body: [
      "Room checklists work when they follow the route through the room rather than grouping tasks by type. Enter, strip, bathroom, bedroom, surfaces, replenish, final look from the doorway. Cleaning in a fixed sequence is what makes rooms consistent between housekeepers and what makes a room take a predictable amount of time.",
      "Departure and stayover are different jobs and this sheet marks which one applies to each row. Treating a stayover like a departure wastes linen and time; treating a departure like a stayover is how a room goes out with the previous guest's hair in the shower. Circle the service type at the top of each room block.",
      "The rows most complained about by guests are the ones easiest to miss because they are not dirty-looking: the kettle and its lid, remote control, light switches, door handles, the underside of the toilet seat, hairdryer filter, and behind the bathroom door. They are on the list for that reason.",
      "The supervisor check line is what keeps standards from drifting. Spot-check a proportion of rooms, not all of them, and record which rooms were checked and by whom. A housekeeper who knows any room might be checked cleans every room as though it will be.",
    ],
    sheet: {
      kind: "checklist",
      orientation: "portrait",
      headerFields: ["Property", "Date", "Housekeeper", "Rooms allocated"],
      columns: [
        { name: "Task", width: 6 },
        { name: "Dep", hint: "Departure", width: 1 },
        { name: "Stay", hint: "Stayover", width: 1 },
        { name: "Done", hint: "Initials", width: 1 },
        { name: "Issue / maintenance", width: 3 },
      ],
      sections: [
        {
          title: "On entering",
          rows: [
            "Knock, announce, wait, then enter — even if the room shows as vacant",
            "Open curtains and window; check for odour and for anything left behind",
            "Check for damage, stains, missing items and anything to report before you start",
            "Strip bed linen and towels; check under the bed and behind the headboard",
            "Empty all bins and replace liners",
          ],
        },
        {
          title: "Bathroom",
          rows: [
            "Toilet cleaned inside, outside, seat both sides and behind the base",
            "Shower and bath scrubbed, screen and grout cleaned, drain clear of hair",
            "Sink, taps and plughole cleaned and descaled",
            "Mirror and glass cleaned streak-free",
            "Behind the bathroom door and the extractor grille wiped",
            "Floor cleaned into the corners and behind the toilet",
            "Towels replaced to standard and folded; bath mat replaced",
            "Amenities, soap, paper and spare roll replenished",
          ],
        },
        {
          title: "Bedroom",
          rows: [
            "Bed made to standard, linen change on departure and per policy on stayover",
            "Mattress protector and pillows checked for stains",
            "Dust all surfaces including headboard, skirting, picture frames and lampshades",
            "Kettle emptied, descaled, lid and spout cleaned; cups replaced clean",
            "Tea, coffee, sugar and water replenished; check expiry dates",
            "Remote control, phone, light switches and door handles wiped",
            "TV screen wiped and TV on the correct channel or welcome screen",
            "Wardrobe: hangers to standard, spare bedding, safe empty and unlocked, iron and board present",
            "Hairdryer present, working and filter clean",
            "Mini fridge cleaned and empty or stocked to standard",
            "Windows, sills and mirrors cleaned; glass smear-free",
            "Vacuum whole floor including under the bed and along edges",
          ],
        },
        {
          title: "Final check from the doorway",
          rows: [
            "Compendium, notices and fire evacuation notice present and correct",
            "Curtains hanging straight, cushions and throw to standard",
            "Lights all working; bulbs replaced where needed",
            "Heating or air conditioning set to standard and remote in place",
            "Room smells fresh and there is no visible dust from the door",
            "Any maintenance issue recorded and reported before leaving",
            "Door locked and room marked ready in the system",
          ],
        },
        {
          title: "Supervisor",
          rows: [
            "Room number spot-checked",
            "Passed / re-clean required — with the reason",
            "Supervisor initials and time",
          ],
        },
      ],
      footerNotes: [
        "Mark whether each room is a departure or a stayover before you start — they are different jobs.",
        "Report maintenance issues before you leave the room, not at the end of the shift.",
        "Supervisors spot-check a proportion of rooms and record which ones. Consistency comes from rooms being checkable, not from checking every room.",
      ],
    },
    howToUse: [
      "Print one sheet per housekeeper per shift and write their room allocation in the header.",
      "For each room, mark whether it is a departure or a stayover before starting.",
      "Work the sections in order — entering, bathroom, bedroom, final check — rather than jumping around.",
      "Initial each row as you complete it and write anything broken in the issue column immediately.",
      "Do the final check standing in the doorway, looking at the room as a guest would.",
      "Hand the sheet to the supervisor, who spot-checks a proportion of rooms and signs the last section.",
    ],
    whatsIncluded: [
      "Printable PDF, portrait A4, five sections following the route through the room",
      "Excel (.xlsx) version you can edit to your own room standard",
      "CSV version for import",
      "Separate departure and stayover columns",
      "The commonly missed items: kettle lid, remote, switches, hairdryer filter, behind the bathroom door",
      "Supervisor spot-check block with pass or re-clean",
    ],
    faqs: [
      {
        q: "What should be on a housekeeping checklist?",
        a: "Every task in the order you move through the room, split by departure and stayover, plus the items guests notice most: bathroom detail, kettle and cups, remote and switches, linen standard, and a final look from the doorway.",
      },
      {
        q: "How long should it take to clean a hotel room?",
        a: "It depends on room size, standard and whether it is a departure or a stayover, and every property sets its own target. Working in a fixed sequence is what makes the time predictable enough to plan a rota around.",
      },
      {
        q: "What is the difference between a departure and a stayover clean?",
        a: "A departure is a full reset — all linen and towels changed, everything replenished, the room checked as though for a new guest. A stayover is refresh and replenish, with linen changed according to your own policy.",
      },
      {
        q: "How many rooms should a supervisor spot-check?",
        a: "A proportion rather than all of them, chosen unpredictably, and recorded. What creates consistency is that any room could be checked, not that every room is.",
      },
    ],
    related: ["guest-incident-log", "front-of-house-opening-closing-checklist", "daily-weekly-cleaning-schedule"],
    keywords: [
      "free housekeeping checklist template",
      "hotel room cleaning checklist pdf",
      "housekeeping room checklist excel free",
      "guesthouse room cleaning checklist template",
    ],
  },
  {
    slug: "guest-incident-log",
    category: "hotel",
    name: "Guest incident & complaint log",
    h1: "Free guest incident and complaint log template",
    title: "Free Guest Incident & Complaint Log | Rotahr",
    metaDescription:
      "Free guest incident and complaint log template in PDF and Excel. Records what happened, what was offered, the cost of the resolution and whether the guest was followed up.",
    answer:
      "This free guest incident and complaint log template — printable PDF or editable Excel — records each incident with what was offered, what it cost, who resolved it and whether anyone followed up, so recurring problems become visible instead of being absorbed shift by shift.",
    body: [
      "Individually, guest complaints get handled and forgotten. Logged, they turn into a pattern: the same room, the same shift, the same noise, the same booking channel. That pattern is the only thing that gets a problem fixed rather than compensated for over and over again, which is why the log has a room or table column and a category.",
      "Record what was offered and what it cost. Most venues have no idea what service recovery costs them in a month, and it is usually a bigger number than the maintenance job that would have prevented it. Two hundred in comped meals against a broken extractor fan is an easy decision once it is written down.",
      "The follow-up column is the one that changes outcomes. A guest whose complaint was acknowledged the next day very often does not leave the review they were composing in the lobby. A guest who was promised a call and never got one writes a worse review than they would have originally.",
      "Guest complaints contain personal data, and sometimes health or dietary information. Keep the log secure rather than on the host stand, record only what you need to resolve and learn from the incident, and follow your own data protection obligations on retention.",
    ],
    sheet: {
      kind: "log",
      orientation: "landscape",
      headerFields: ["Property / venue", "Month", "Duty manager", "Reviewed on"],
      columns: [
        { name: "Date / time", width: 2 },
        { name: "Guest name / booking ref", width: 3 },
        { name: "Room / table", width: 1 },
        { name: "Category", hint: "Cleanliness / noise / service / maintenance / food / billing / safety", width: 3 },
        { name: "What happened", width: 5 },
        { name: "Action taken at the time", width: 4 },
        { name: "Offered", hint: "Comp / refund / move / discount / none", width: 2 },
        { name: "Cost", width: 1 },
        { name: "Handled by", width: 1 },
      ],
      extraColumns: [
        { name: "Follow-up done", hint: "Y / N — date and by whom", width: 2 },
        { name: "Root cause", width: 3 },
        { name: "Preventive action and owner", width: 3 },
        { name: "Review posted?", hint: "Y / N — platform", width: 2 },
      ],
      rowCount: 16,
      footerNotes: [
        "Log every complaint, including the ones resolved instantly. The pattern is the value, not the individual entry.",
        "Record what was offered and what it cost — service recovery spend is usually higher than the fix that would prevent it.",
        "This log contains personal data. Store it securely, record only what you need, and follow your own data protection and retention obligations.",
      ],
    },
    howToUse: [
      "Keep the log somewhere secure that duty managers can reach, not on the desk or host stand.",
      "Log every complaint on the shift it happens, including ones resolved on the spot.",
      "Categorise it and record the room or table — that is what makes patterns visible.",
      "Write what was actually offered and what it cost, at cost price.",
      "Follow up with the guest where appropriate and record the date and who did it.",
      "Review the month's log with the management team, pick the most repeated category, and assign a preventive action with an owner.",
    ],
    whatsIncluded: [
      "Printable PDF, landscape A4, 16 rows per sheet",
      "Excel (.xlsx) version with follow-up, root cause, preventive action and review-posted columns",
      "CSV version for import",
      "Category column covering cleanliness, noise, service, maintenance, food, billing and safety",
      "Offered and cost columns to total your service recovery spend",
      "Monthly review field for spotting repeat causes",
    ],
    faqs: [
      {
        q: "Why keep a guest complaint log?",
        a: "Because a single complaint gets handled and forgotten, while a logged pattern gets fixed. The log shows you which room, shift, dish or channel keeps generating problems, and what the compensation is costing you against the price of the fix.",
      },
      {
        q: "Should we log complaints that were resolved on the spot?",
        a: "Yes. Instantly resolved complaints are the ones that reveal recurring issues most reliably, precisely because nobody escalates them and nobody remembers them a week later.",
      },
      {
        q: "How should we follow up after a guest complaint?",
        a: "Acknowledge it, say what you are doing about it, and do it within the timeframe you promised. Record the follow-up on the log — an unkept promise to call back produces a worse outcome than the original problem.",
      },
      {
        q: "Can we store guest complaint records?",
        a: "Yes, with care: keep only what you need to resolve and learn from the incident, store it securely, restrict access to managers, and set a retention period in line with your own data protection obligations.",
      },
    ],
    related: ["housekeeping-room-checklist", "accident-incident-report-form", "front-of-house-opening-closing-checklist"],
    keywords: [
      "free guest complaint log template",
      "hotel incident log template pdf",
      "guest incident report excel free",
      "complaint tracking sheet hospitality",
    ],
  },
];
