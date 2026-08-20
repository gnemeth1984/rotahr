import type { FreeTemplate } from "../types";

export const cleaningTemplates: FreeTemplate[] = [
  {
    slug: "daily-weekly-cleaning-schedule",
    category: "cleaning",
    name: "Daily & weekly cleaning schedule",
    h1: "Free daily and weekly cleaning schedule template",
    title: "Free Daily & Weekly Cleaning Schedule | Rotahr",
    metaDescription:
      "Free daily and weekly cleaning schedule template for kitchens and bars. Printable PDF and Excel, with tasks by area, frequency, method and initials for each day.",
    answer:
      "This free daily and weekly cleaning schedule template — printable PDF or editable Excel — lists cleaning tasks by area with a frequency, a method and an initials box for every day of the week, so it is obvious what was cleaned, when and by whom.",
    body: [
      "A cleaning schedule is only credible if it says who did it and when. A laminated list of tasks on the wall proves an intention; a dated sheet with initials against each task is the record an inspector, a franchisor or an auditor will accept. That is the entire difference between the two, and it is why every row here has a day-by-day sign-off column rather than a single tick box.",
      "The method column is the part most schedules leave out and the part that makes the job repeatable. \"Clean the slicer\" means five different things to five different people. \"Strip, wash in hot soapy water, sanitise, air dry, reassemble\" means one. Write the method once and you stop training it verbally every time someone new starts.",
      "Split tasks by area rather than by frequency. People clean the section they are standing in, so a schedule organised by kitchen, bar, front of house and staff areas gets followed, while one organised into a daily list and a weekly list gets read once and abandoned.",
      "Anything that needs a contractor, a ladder or the equipment stripped down belongs on your deep clean schedule instead. Mixing a quarterly duct clean into a daily sheet is the fastest way to have a schedule with permanently blank rows on it.",
    ],
    sheet: {
      kind: "checklist",
      orientation: "landscape",
      headerFields: ["Venue / site", "Week commencing", "Manager sign-off"],
      columns: [
        { name: "Task and method", hint: "What to clean, and how", width: 7 },
        { name: "Freq", hint: "D / W", width: 1 },
        { name: "Mon", width: 1 },
        { name: "Tue", width: 1 },
        { name: "Wed", width: 1 },
        { name: "Thu", width: 1 },
        { name: "Fri", width: 1 },
        { name: "Sat", width: 1 },
        { name: "Sun", width: 1 },
      ],
      extraColumns: [
        { name: "Chemical / dilution", width: 2 },
        { name: "Contact time", hint: "Minutes per the label", width: 1 },
        { name: "Notes", width: 3 },
      ],
      sections: [
        {
          title: "Kitchen — food contact surfaces",
          rows: [
            "Prep benches: clear, wash with detergent, sanitise, leave for the label contact time — after every task and at close",
            "Chopping boards: wash in hot soapy water, sanitise, air dry upright — between uses and at close",
            "Knives and small tools: wash, sanitise, dry — after every use",
            "Slicer, mandolin, mixer: strip down, wash, sanitise, air dry, reassemble guarded — after each use",
            "Probe thermometer: wipe with a sanitiser wipe before and after every reading",
            "Blast chiller and cooling racks: wipe and sanitise — daily",
          ],
        },
        {
          title: "Kitchen — equipment and structure",
          rows: [
            "Ranges, grills and salamander: degrease and wipe down — daily at close",
            "Fryers: skim during service, filter or change oil, wipe housing — daily",
            "Combi and ovens: run the cleaning cycle or degrease, clean seals and trays — daily",
            "Microwave: inside and out, including the door seal — daily",
            "Fridge and freezer handles, seals and interiors: wipe, sanitise, check for spills — daily",
            "Sinks and taps: descale, sanitise, clear the strainer — daily",
            "Hand wash basin: sanitise, restock soap and paper — daily and during service",
            "Canopy filters: remove and run through the dishwasher or soak — weekly",
            "Walls and splashbacks behind the line: degrease — weekly",
            "Under and behind all mobile equipment: pull out, sweep, mop, sanitise — weekly",
          ],
        },
        {
          title: "Waste, floors and delivery area",
          rows: [
            "Internal bins: emptied, liner changed, lid and body wiped — daily",
            "External bin store: swept, lids closed, no bags on the ground — daily",
            "Kitchen floor: sweep, mop with detergent, dry — daily at close",
            "Floor drains and gullies: lift, clear, flush and sanitise — weekly",
            "Delivery and goods-in area: swept and clear of packaging — daily",
            "Mops, buckets and cloths: washed, sanitised and stored dry, not in dirty water — daily",
          ],
        },
        {
          title: "Bar and front of house",
          rows: [
            "Bar top, drip trays and speed rails: wash and sanitise — daily",
            "Ice machine scoop and bin: emptied, cleaned and sanitised — daily and weekly deep wipe",
            "Post-mix nozzles and guns: soak and brush — daily",
            "Glasswasher: strain, clean jets, wipe seals, leave open — daily",
            "Coffee machine: backflush group heads, clean steam wand, soak baskets, clean grinder hopper — daily",
            "Tables, chairs, high chairs and menus: wipe and sanitise — daily",
            "Toilets: full clean, restock, and check on the interval set in your service checklist — daily plus interval checks",
            "Front of house floor: swept and mopped — daily",
          ],
        },
        {
          title: "Staff areas",
          rows: [
            "Staff room surfaces, table and microwave: wipe and sanitise — daily",
            "Staff fridge: cleared of out-of-date food, wiped, sanitised — weekly",
            "Changing area and lockers: swept, wiped, no food stored — weekly",
          ],
        },
      ],
      footerNotes: [
        "Initial each task on the day it is done. A single tick with no name or date is not a cleaning record.",
        "Follow the dilution and contact time on the chemical label — sanitiser wiped off straight away has not sanitised anything.",
        "Ladders, stripped-down equipment and contractor work belong on the deep clean schedule, not on this sheet.",
      ],
    },
    howToUse: [
      "Print one sheet per week and keep it in the area it covers, not in the office.",
      "Delete rows for equipment you do not have and add your own using the Excel version.",
      "Fill in the chemical and dilution columns from your own product labels before you print.",
      "Whoever completes a task initials the box for that day, as they finish it.",
      "Check the sheet at close: blank boxes are the jobs to hand out before people leave.",
      "The manager signs the sheet at the end of the week and files it with your food safety records.",
    ],
    whatsIncluded: [
      "Printable PDF, landscape A4, tasks grouped by area with a box per day",
      "Excel (.xlsx) version with chemical, dilution and contact time columns",
      "CSV version for import",
      "Method written into every task so the job is repeatable",
      "Kitchen, bar, front of house, waste and staff area sections",
      "Weekly manager sign-off field",
    ],
    faqs: [
      {
        q: "What should be on a restaurant cleaning schedule?",
        a: "Every food contact surface and every piece of equipment, each with a frequency, a method and a sign-off. Group it by area so people can follow it where they stand, and keep contractor and stripped-down jobs on a separate deep clean schedule.",
      },
      {
        q: "What is the difference between cleaning and sanitising?",
        a: "Cleaning removes visible soil and grease with detergent. Sanitising reduces bacteria on an already clean surface and only works if you leave the product on for the contact time stated on its label. Sanitising a greasy surface achieves very little.",
      },
      {
        q: "How long should we keep completed cleaning schedules?",
        a: "Keep them for the retention period your own food safety management system specifies — a few months of completed sheets is what demonstrates a routine rather than a one-off tidy before an inspection.",
      },
      {
        q: "Can I use this in a bar with no kitchen?",
        a: "Yes. Use the bar, front of house, waste and staff area sections and delete the kitchen equipment rows in the Excel version.",
      },
    ],
    related: ["deep-clean-schedule", "kitchen-opening-closing-checklist", "fridge-freezer-temperature-log"],
    keywords: [
      "free cleaning schedule template restaurant",
      "daily cleaning schedule template pdf",
      "kitchen cleaning schedule excel free",
      "bar cleaning rota template",
    ],
  },
  {
    slug: "deep-clean-schedule",
    category: "cleaning",
    name: "Deep clean schedule",
    h1: "Free deep clean schedule template",
    title: "Free Deep Clean Schedule Template | Rotahr",
    metaDescription:
      "Free deep clean schedule template for hospitality. Printable PDF and Excel covering monthly, quarterly and annual tasks, contractor jobs, dates done and next due.",
    answer:
      "This free deep clean schedule template — printable PDF or editable Excel — tracks the monthly, quarterly and annual cleaning that daily routines never reach, with a last-done date, a next-due date and space for contractor certificate references.",
    body: [
      "Deep cleaning is planned work, not a task you fit in at close. Everything on this schedule needs equipment moved, panels off, a ladder, a contractor, or the site closed — which is exactly why it slips for months unless it has its own sheet with dates on it.",
      "The two columns that make this schedule work are last done and next due. A deep clean list without dates tells you nothing; the same list with \"ductwork: last done 14 March, next due 14 September\" tells you what to book this month. Fill in the next-due date the moment you complete a job.",
      "Split it clearly between what your own team can do and what needs a specialist. Extraction ductwork, grease trap servicing, kitchen suppression systems and pest treatments generally need a contractor with a certificate, and that certificate is what an insurer or auditor will ask to see. There is a reference column for exactly that.",
      "Frequencies here are common practice, not a legal schedule. How often a duct needs cleaning depends on how much you fry and how many hours the canopy runs; a heavy-use site needs it far more often than a low-volume one. Set your own intervals from your risk assessment and your contractor's advice, then hold yourself to them with this sheet.",
    ],
    sheet: {
      kind: "checklist",
      orientation: "portrait",
      headerFields: ["Venue / site", "Year", "Responsible manager"],
      columns: [
        { name: "Deep clean task", width: 6 },
        { name: "Freq", hint: "M / Q / A", width: 1 },
        { name: "Last done", hint: "Date", width: 2 },
        { name: "By whom", width: 2 },
        { name: "Next due", hint: "Date", width: 2 },
      ],
      extraColumns: [
        { name: "Contractor", width: 3 },
        { name: "Certificate reference", width: 3 },
        { name: "Cost", width: 2 },
      ],
      sections: [
        {
          title: "Monthly — in-house",
          rows: [
            "Walk-in chill and freezer: fully emptied, shelving out, walls, floor and ceiling cleaned, seals checked",
            "Fridge and freezer condenser coils vacuumed and fans wiped",
            "Behind and under the cooking line: equipment pulled out, floor and wall degreased",
            "Extraction canopy: internal baffles and plenum degreased as far as safely reachable",
            "Dry store: emptied shelf by shelf, wiped, stock rotated and dated, pest check",
            "Ice machine: descaled and sanitised per the manufacturer's instructions",
            "Coffee machine: full descale and deep clean of group heads and grinder",
            "Glasswasher and dishwasher: descaled, jets and wash arms stripped and cleared",
            "Bin store: pressure washed and disinfected",
            "High-level surfaces: pipework, shelf tops, light fittings and ledges dusted and wiped",
          ],
        },
        {
          title: "Quarterly — in-house or contractor",
          rows: [
            "Floor: deep scrubbed and re-sealed where applicable, grout cleaned",
            "Floor drains and gullies: lifted, rodded and disinfected",
            "Walls and ceilings in the kitchen: washed down in full",
            "Ovens and combis: fully stripped, seals and door glass cleaned, trays descaled",
            "Fryers: boiled out and fully stripped",
            "Cellar: floor scrubbed, lines and couplers deep cleaned, kegs and racking moved and cleaned",
            "Upholstery and soft furnishings: cleaned",
            "Window and external signage clean",
            "Staff lockers and changing area: emptied and deep cleaned",
          ],
        },
        {
          title: "Contractor — record the certificate",
          rows: [
            "Extraction ductwork deep clean to standard — certificate required",
            "Kitchen fire suppression system service — certificate required",
            "Grease trap emptied and serviced",
            "Pest control visit and report",
            "Waste and grease collection — licensed carrier documentation",
            "Carpet and hard floor specialist clean",
            "Air conditioning service and filter clean",
            "Water system and tank check where applicable",
            "External high-level and gutter clean",
          ],
        },
        {
          title: "Annual review",
          rows: [
            "Deep clean schedule reviewed against actual frequency achieved",
            "Chemical list and safety data sheets reviewed and current",
            "Equipment condition review — what needs replacing rather than cleaning",
            "Contractor contracts and certificates all in date and filed",
          ],
        },
      ],
      footerNotes: [
        "Fill in the next-due date the moment a job is completed — an undated deep clean list is the reason jobs slip a year.",
        "Frequencies shown are common practice, not a legal schedule. Set your own from your risk assessment and your contractor's advice.",
        "Keep contractor certificates filed against the row. After an incident, an insurer asks for the certificate, not the checklist.",
      ],
    },
    howToUse: [
      "Set your own frequency for each row based on how heavily you use the equipment, then write it in the freq column.",
      "Enter the last known completion date for every task so you can see what is already overdue.",
      "Calculate and write the next-due date for each row before you put the sheet up.",
      "Book contractor jobs from the next-due dates at the start of each month, not when someone notices.",
      "On completion, record who did it, the new last-done date, the next due date and any certificate reference.",
      "Review the whole schedule once a year against what you actually achieved and adjust the frequencies to something honest.",
    ],
    whatsIncluded: [
      "Printable PDF, portrait A4, monthly, quarterly, contractor and annual sections",
      "Excel (.xlsx) version with contractor, certificate reference and cost columns",
      "CSV version for import",
      "Last done, by whom and next due columns on every task",
      "Hospitality-specific rows: ductwork, grease trap, suppression system, cellar, ice machine",
      "Annual review block to check the schedule against reality",
    ],
    faqs: [
      {
        q: "How often should a commercial kitchen be deep cleaned?",
        a: "It depends on use. Heavy frying and long canopy hours push extraction cleaning far more frequently than a low-volume site, and quarterly is common for full structural cleans. Set your own intervals from your risk assessment and your contractor's advice rather than copying a generic figure.",
      },
      {
        q: "What is the difference between a deep clean and a daily clean?",
        a: "A daily clean is what one person can do on shift with a cloth and a spray. A deep clean needs equipment moved or stripped, a ladder, a specialist chemical or a contractor — which is why it needs a booked date rather than a line on a daily sheet.",
      },
      {
        q: "Do we need a certificate for extraction duct cleaning?",
        a: "Get one. A dated certificate from the contractor is the evidence insurers and auditors ask for, and a claim after a kitchen fire is the worst possible moment to discover you only have a tick on a checklist.",
      },
      {
        q: "Who should be responsible for the deep clean schedule?",
        a: "One named manager. Deep cleaning slips when it is everyone's job — the sheet has a responsible manager field for that reason, and booking the contractor jobs is the main part of the role.",
      },
    ],
    related: ["daily-weekly-cleaning-schedule", "fire-safety-checklist", "cellar-check-line-cleaning-log"],
    keywords: [
      "free deep clean schedule template",
      "deep cleaning schedule restaurant pdf",
      "kitchen deep clean checklist excel",
      "hospitality deep clean planner template",
    ],
  },
];
