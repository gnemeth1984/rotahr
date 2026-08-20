import type { FreeTemplate } from "../types";

export const openCloseTemplates: FreeTemplate[] = [
  {
    slug: "kitchen-opening-closing-checklist",
    category: "open-close",
    name: "Kitchen opening & closing checklist",
    h1: "Free kitchen opening and closing checklist template",
    title: "Free Kitchen Opening & Closing Checklist | Rotahr",
    metaDescription:
      "Free kitchen opening and closing checklist template in PDF and Excel. Section-by-section tasks with initials and time columns, built for a real service day.",
    answer:
      "This free kitchen opening and closing checklist template — printable PDF or editable Excel — lists the open and close tasks in the order you actually do them, with initials and time columns so the last hour of the night is never guesswork.",
    body: [
      "A kitchen checklist earns its place by covering the tasks that cost money when they are missed, not by listing everything a kitchen does. Gas off, fridges reading in range, hot holding switched on early enough, waste out, mats down, delivery area clear. Those are the items that cause a failed check, a wasted prep batch or a next-morning scramble.",
      "The order matters as much as the content. Opening tasks are sequenced so anything with a lead time — hot holding, combi, fryers coming up to temperature, defrosting — is started before anyone stops to check the walk-in. Closing tasks are sequenced so the things that must happen while there is still light and staff on site come before the final walk-round.",
      "Every row has an initials column rather than a tick box. A tick tells you a task was marked done; initials tell you who marked it. That difference is the only reason a checklist ever gets taken seriously after the first fortnight.",
      "This is a general kitchen checklist, not a food safety management system. It sits alongside your temperature logs and cleaning schedule — the open and close checks confirm the equipment and the space are right, and the logs record the readings.",
    ],
    sheet: {
      kind: "checklist",
      orientation: "portrait",
      headerFields: ["Venue / site", "Date", "Opening chef", "Closing chef"],
      columns: [
        { name: "Task", width: 6 },
        { name: "Done", hint: "Initials", width: 1 },
        { name: "Time", hint: "hh:mm", width: 1 },
        { name: "Issue found / action", width: 3 },
      ],
      sections: [
        {
          title: "Opening — first 15 minutes",
          rows: [
            "Turn on extraction and check it is pulling",
            "Gas on at the main and burners tested",
            "Switch on combi, fryers and hot holding so they reach temperature before service",
            "Check fridge and freezer displays against target and log the readings",
            "Check nothing has been left out overnight; discard anything unlabelled",
            "Wash hands, change into clean whites, check nobody on shift is reporting illness",
          ],
        },
        {
          title: "Opening — before service",
          rows: [
            "Probe thermometer tested and wiped, spare batteries on hand",
            "Sanitiser made up fresh, cloths and blue roll stocked",
            "Hand wash sink stocked with soap and paper, hot water running",
            "Check use-by dates on all prep and rotate stock front to back",
            "Prep list checked against today's bookings and specials",
            "Allergen information for today's specials written up and accurate",
            "First aid kit and blue plasters present and stocked",
            "Floor dry, mats down, walkways clear",
          ],
        },
        {
          title: "Closing — during the last hour",
          rows: [
            "Cool down and date-label all cooked food, recording temperatures in the cooling log",
            "Wrap, label and rotate all open prep",
            "Break down and clean the pass, boards and section surfaces",
            "Empty, clean and refill sanitiser buckets",
            "Fryers filtered or oil changed, oil level recorded",
            "Take waste and cardboard out to the correct bins; area left tidy",
          ],
        },
        {
          title: "Closing — final walk-round",
          rows: [
            "All food off the bench and in a labelled, in-range unit",
            "Fridge and freezer temperatures checked and logged for close",
            "Gas off at the main; all burners, grills and fryers off",
            "Combi, salamander and hot holding off and cooling",
            "Extraction filters cleaned or logged for cleaning",
            "Floors swept and mopped, mats lifted, drains clear",
            "Fire exits clear, no cardboard stored against them",
            "Water off where required, taps closed, no leaks",
            "Lights off, door locked, keys accounted for",
          ],
        },
      ],
      footerNotes: [
        "Initial each row rather than ticking it — a checklist nobody can be identified from stops being completed honestly.",
        "Anything you could not complete goes in the issue column with what you did about it, not left blank.",
        "This checklist sits alongside your temperature and cleaning records. It does not replace a food safety management system.",
      ],
    },
    howToUse: [
      "Print one sheet a day and clip it where the section starts, not in the office.",
      "The opening chef works down the opening sections in order, initialling and timing each row.",
      "Start anything with a lead time — hot holding, combi, fryers — before you begin checking stock.",
      "Log fridge and freezer readings on your temperature log as well as ticking the row here.",
      "The closing chef begins the last-hour section before service finishes, not after.",
      "Complete the final walk-round with the sheet in hand, then sign it and leave it for the manager to review the next morning.",
    ],
    whatsIncluded: [
      "Printable PDF, portrait A4, four sequenced sections on one page",
      "Excel (.xlsx) version you can edit to match your kitchen's equipment",
      "CSV version for import",
      "Initials and time columns on every row",
      "Issue found / action column for anything incomplete",
      "Separate opening chef and closing chef sign-off fields",
    ],
    faqs: [
      {
        q: "What should be on a kitchen closing checklist?",
        a: "The non-negotiables are: all food labelled and in an in-range unit, cooked food cooled and recorded, gas and all cooking equipment off, waste out, floors done, fire exits clear, and a final temperature check logged. Everything else is site-specific.",
      },
      {
        q: "Who should sign the kitchen checklist?",
        a: "The person doing the tasks initials each row, and the opening or closing chef signs the sheet as a whole. A manager reviewing yesterday's sheet the next morning is what makes the habit stick.",
      },
      {
        q: "Can I change the tasks on the list?",
        a: "Yes — the Excel version is meant to be edited. Delete equipment you do not have and add anything specific to your site, such as a wood oven, a pass-through dishwasher or a separate prep kitchen.",
      },
      {
        q: "Does this replace a HACCP food safety system?",
        a: "No. It is an operational open and close checklist. Your temperature logs, cooling records, delivery checks and cleaning schedule are the food safety records — this sheet confirms the space and equipment were set up and shut down properly.",
      },
    ],
    related: [
      "bar-opening-closing-checklist",
      "front-of-house-opening-closing-checklist",
      "fridge-freezer-temperature-log",
    ],
    keywords: [
      "kitchen opening and closing checklist template",
      "free kitchen closing checklist pdf",
      "restaurant kitchen opening checklist excel",
      "commercial kitchen close down checklist",
    ],
  },
  {
    slug: "bar-opening-closing-checklist",
    category: "open-close",
    name: "Bar opening & closing checklist",
    h1: "Free bar opening and closing checklist template",
    title: "Free Bar Opening & Closing Checklist | Rotahr",
    metaDescription:
      "Free bar opening and closing checklist template as a printable PDF or Excel sheet. Covers cellar, lines, glassware, till, stock and lock-up with initials and times.",
    answer:
      "This free bar opening and closing checklist template — printable PDF or editable Excel — runs from cellar and gas through to till reconciliation and lock-up, with initials and time columns on every task.",
    body: [
      "A bar close is where the two most expensive kinds of loss meet: stock that walks and cash that does not reconcile. A checklist that ends with a counted till and a locked spirit rail is worth more than one that lists forty cleaning tasks and stops there.",
      "The opening section front-loads the things with lead times — cellar temperature, gas pressure, glasswasher up to temperature, ice bins filled, fridges pulling down. If those are not started first, the bar opens with warm bottles and no ice, which no amount of later tidying fixes.",
      "The closing section separates tasks that must happen while customers are still in — last orders, glass collection, cleaning down what is finished with — from the final lock-up, which one named person does alone with the sheet in hand. Splitting it that way is what stops the last twenty minutes turning into six people doing the same three jobs.",
      "Line cleaning is referenced here but recorded separately. A checklist row proves you thought about it; a dated line cleaning log proves you did it, which is the record you actually want when a beer quality issue comes up.",
    ],
    sheet: {
      kind: "checklist",
      orientation: "portrait",
      headerFields: ["Venue / site", "Date", "Opening bartender", "Closing / duty manager"],
      columns: [
        { name: "Task", width: 6 },
        { name: "Done", hint: "Initials", width: 1 },
        { name: "Time", hint: "hh:mm", width: 1 },
        { name: "Issue found / action", width: 3 },
      ],
      sections: [
        {
          title: "Opening — cellar and equipment",
          rows: [
            "Cellar temperature checked and recorded",
            "Gas cylinders checked, spare connected and in date",
            "Keg and cask levels checked, next kegs moved into position",
            "All lines pulled through and tasted, first pint poured to waste",
            "Glasswasher on, detergent and rinse aid topped up",
            "Ice machine checked and ice bins filled",
            "Bottle fridges reading in range and fully stocked",
            "Post-mix and syrups checked and connected",
          ],
        },
        {
          title: "Opening — bar setup",
          rows: [
            "Till opened, float counted and signed for by two people",
            "Card terminals on, connected and test transaction cleared",
            "Garnish prepped, dated and covered",
            "Spirit rail stocked, optics fitted and free-pour measures checked",
            "Glassware polished and stocked to par at every station",
            "Bar mats, drip trays and speed rails clean and in place",
            "Wine list and drinks specials board correct for today",
            "Age verification signage displayed, refusals log to hand",
          ],
        },
        {
          title: "Closing — with customers still in",
          rows: [
            "Last orders called at the required time and logged",
            "Glasses collected and run through the glasswasher",
            "Bottle bins emptied and glass taken out",
            "Garnish binned or covered and dated",
            "Post-mix guns soaked and nozzles cleaned",
            "Fridges restocked for tomorrow, rotating oldest to the front",
          ],
        },
        {
          title: "Closing — lock-up by one named person",
          rows: [
            "Till cashed up, takings reconciled against the report and any variance noted",
            "Cash bagged and put in the safe; float set for tomorrow",
            "Spirits and premium stock locked away or rail secured",
            "Taps pulled clean, nozzles removed and soaked",
            "Cellar door and outside doors locked, gas turned off if policy",
            "Glasswasher drained and left open, ice bins emptied",
            "Bar surfaces, sinks and floor cleaned; drains flushed",
            "Fire exits clear and alarm set",
            "Lights, TVs, music and heaters off",
            "Keys accounted for and building secured",
          ],
        },
      ],
      footerNotes: [
        "Two people count the float at open and the takings at close. Any variance is written on the sheet the same night, not explained the next day.",
        "Record line cleaning in your line cleaning log as well — a tick here is not a dated cleaning record.",
        "One named person completes the lock-up section with the sheet in hand.",
      ],
    },
    howToUse: [
      "Print one sheet per trading day and keep it behind the bar on a clipboard.",
      "Start the cellar and equipment section first — cellar temperature, gas, lines, glasswasher and ice all have lead times.",
      "Count the float with a second person and both sign for it before the first sale.",
      "Work the with-customers-in section during the last hour of trade so the close does not overrun.",
      "One named person does the lock-up section alone, initialling and timing each row.",
      "Reconcile the till, write down any variance, and leave the sheet for the manager to review.",
    ],
    whatsIncluded: [
      "Printable PDF, portrait A4, four sections split by open, setup, service-end and lock-up",
      "Excel (.xlsx) version you can edit for your own bar layout and dispense setup",
      "CSV version for import",
      "Cellar, gas, line and glasswasher checks in the opening block",
      "Till float and takings reconciliation rows with variance space",
      "Initials, time and issue columns on every task",
    ],
    faqs: [
      {
        q: "What should be on a bar closing checklist?",
        a: "Cash reconciled and secured, spirits and premium stock locked, taps and nozzles cleaned, fridges restocked and rotated, glasswasher drained, cellar and outside doors locked, fire exits clear, alarm set. Cleaning tasks matter, but cash and stock security are the ones that cost you if skipped.",
      },
      {
        q: "How often should beer lines be cleaned?",
        a: "Every seven days is the interval most breweries and dispense equipment suppliers specify, with some allowing longer on certain systems. Follow your supplier's guidance for your own setup and record every clean with a date and initials in a separate line cleaning log.",
      },
      {
        q: "Should the same person open and close the bar?",
        a: "No — separate the roles and have each sign their own section. Opening and closing checks done by the same person on the same sheet remove the second pair of eyes that catches what was missed.",
      },
      {
        q: "How do we handle a till variance at close?",
        a: "Write it on the sheet the same night with the amount, who counted and who witnessed. A variance recorded immediately is an operational issue; a variance found days later during a paperwork review is an investigation.",
      },
    ],
    related: [
      "cellar-check-line-cleaning-log",
      "kitchen-opening-closing-checklist",
      "daily-takings-sheet",
    ],
    keywords: [
      "bar opening and closing checklist template",
      "free bar closing checklist pdf",
      "pub opening checklist excel",
      "bar lock up checklist template",
    ],
  },
  {
    slug: "front-of-house-opening-closing-checklist",
    category: "open-close",
    name: "Front of house opening & closing checklist",
    h1: "Free front of house opening and closing checklist template",
    title: "Free Front of House Opening & Closing List | Rotahr",
    metaDescription:
      "Free front of house opening and closing checklist template in PDF and Excel. Covers floor setup, bookings brief, toilets, service standards and end-of-night close.",
    answer:
      "This free front of house opening and closing checklist template — printable PDF or editable Excel — takes the floor from doors-locked to service-ready and back again, including the pre-service brief and the checks guests notice first.",
    body: [
      "Guests judge a room in about ten seconds, and almost always on the same handful of things: a clean table, a clean toilet, the right lighting and someone who knows they have arrived. A front of house checklist should weight those heavily rather than reading like a cleaning schedule for the floor.",
      "The pre-service brief is a task on this sheet, not an optional extra. Covers booked, large parties and their timings, allergy notes, what is off the menu and what the specials actually are — a team that has heard those four things sells more and apologises less. If the brief keeps getting skipped, it is because it is not written down as a step anywhere.",
      "Toilet checks are on an interval, not a single opening tick, because that is the one area where a guest's opinion changes fastest during service. The sheet has slots to initial each check through the day so it is obvious when the last one happened.",
      "The closing block deliberately ends with tomorrow's setup: reset the room, put out the reservations for the next day and note anything broken. A close that leaves the room ready is what allows the next opening shift to spend its time on guests instead of furniture.",
    ],
    sheet: {
      kind: "checklist",
      orientation: "portrait",
      headerFields: ["Venue / site", "Date", "Opening supervisor", "Closing supervisor"],
      columns: [
        { name: "Task", width: 6 },
        { name: "Done", hint: "Initials", width: 1 },
        { name: "Time", hint: "hh:mm", width: 1 },
        { name: "Issue found / action", width: 3 },
      ],
      sections: [
        {
          title: "Opening — the room",
          rows: [
            "Unlock, alarm off, lights and music on at service levels",
            "Heating or air conditioning set; room at a comfortable temperature",
            "Floors clean, no marks from last night, entrance mat clean",
            "Tables wiped, level and set to standard; check every chair for stability",
            "Cutlery, glassware and crockery polished and stocked to par",
            "Condiments filled, wiped and in date",
            "Menus checked — clean, current, correct prices, no missing pages",
            "Specials board written, spelled correctly and accurate",
          ],
        },
        {
          title: "Opening — before doors",
          rows: [
            "Toilets checked: clean, stocked with soap, paper and towels, no odour",
            "Card terminals on and test transaction cleared",
            "Booking sheet or system printed; table plan set for today's covers",
            "Pre-service brief: covers, large parties, timings, allergy notes, 86'd items, specials",
            "Section allocations agreed and staff know their tables",
            "Baby chairs, accessibility route and outside area checked and clear",
            "Staff presentation checked; name badges on",
          ],
        },
        {
          title: "During service",
          rows: [
            "Toilet check and initial — mid-morning",
            "Toilet check and initial — mid-afternoon",
            "Toilet check and initial — evening",
            "Entrance and outside area checked for glasses and litter",
            "Menus wiped between services",
          ],
        },
        {
          title: "Closing",
          rows: [
            "All tables cleared, wiped and reset for tomorrow",
            "Condiments, sauces and sugars refilled and wiped",
            "Cutlery, glass and crockery polished and returned to par",
            "Bin liners changed, waste taken out, recycling separated",
            "Toilets final check and restock",
            "Lost property logged and stored",
            "Tomorrow's bookings printed and any notes flagged to the manager",
            "Maintenance and breakages noted for the manager",
            "Floors swept and mopped, furniture reset, outside furniture secured",
            "Doors locked, alarm set, lights, music and screens off",
          ],
        },
      ],
      footerNotes: [
        "Toilet checks are timed and initialled through the day, not ticked once at open.",
        "Anything broken, faulty or missing goes in the issue column so the manager sees it the next morning.",
        "The pre-service brief is a task, not a nicety — covers, timings, allergy notes, 86'd items and specials.",
      ],
    },
    howToUse: [
      "Print one sheet per trading day and keep it on the host stand where every supervisor can reach it.",
      "Work the room section first, then the before-doors section, initialling and timing each row.",
      "Run the pre-service brief with the team present and tick it only once everyone has heard it.",
      "Initial each timed toilet check as it happens through service.",
      "Close the room so it is ready for tomorrow — reset tables and print the next day's bookings.",
      "Hand the completed sheet to the manager, with breakages and maintenance items written in the issue column.",
    ],
    whatsIncluded: [
      "Printable PDF, portrait A4, four sections covering open, pre-service, service and close",
      "Excel (.xlsx) version you can edit for your own room and service style",
      "CSV version for import",
      "Timed toilet check rows to initial through the day",
      "Pre-service brief step covering covers, timings, allergens, 86'd items and specials",
      "Issue column that doubles as a maintenance and breakage log",
    ],
    faqs: [
      {
        q: "What is a front of house opening checklist?",
        a: "It is the list of tasks that take a dining room from locked and empty to ready for guests — room setup, table standards, menus, toilets, payment terminals, the booking plan and the pre-service brief — with sign-off so it is clear who did what.",
      },
      {
        q: "How often should toilets be checked during service?",
        a: "Set an interval and stick to it. Many venues check at least every two hours, and hourly during peak trade. This template has timed check rows so the last check is always visible rather than assumed.",
      },
      {
        q: "What should be covered in a pre-service brief?",
        a: "Covers booked, large parties and their arrival times, allergy or access notes on any booking, anything off the menu, today's specials with prices, and section allocations. Keep it under five minutes and do it with everyone present.",
      },
      {
        q: "Can this be used in a hotel restaurant?",
        a: "Yes. Add the rows specific to your operation — breakfast setup times, room-charge procedure, in-room dining handover — using the Excel version, and pair it with the housekeeping checklist for the rooms side.",
      },
    ],
    related: [
      "kitchen-opening-closing-checklist",
      "bar-opening-closing-checklist",
      "housekeeping-room-checklist",
    ],
    keywords: [
      "front of house opening checklist template",
      "restaurant opening and closing checklist free",
      "foh closing checklist pdf",
      "dining room opening checklist excel",
    ],
  },
];
