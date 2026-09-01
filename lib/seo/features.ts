/**
 * Feature landing pages — one per product module.
 *
 * These exist because the landing page can only give each module two lines, but
 * the queries people actually search are module-shaped ("restaurant HACCP app",
 * "receipt scanning for restaurants", "food cost calculator"). Each page has to
 * earn its place on specifics only a team that built the module could write —
 * exact temperature thresholds, what the scan reads, what the export contains.
 *
 * Deliberately NOT city-templated: see the warning in locations.ts. Nine pages
 * describing nine genuinely different modules is not a doorway pattern.
 *
 * Audience is international (Ireland, UK, US, Canada, Australia). Where a rule
 * is jurisdiction-specific, say which jurisdiction rather than assuming Ireland.
 */

export interface FeatureFaq {
  q: string;
  a: string;
}

export interface Feature {
  slug: string;
  /** Short nav label. */
  name: string;
  /** H1. Should read as a claim, not a noun. */
  heading: string;
  /** Page title tag. Kept under 60 chars including " | Rotahr". */
  title: string;
  metaDescription: string;
  /**
   * First sentence of the page body. Must answer the H1 directly — this is what
   * answer engines quote, and what the audit's `not-answer-shaped` check looks
   * for.
   */
  answer: string;
  /** Body paragraphs after the answer. */
  body: string[];
  /** Concrete capabilities. Specifics, not adjectives. */
  capabilities: { title: string; detail: string }[];
  /** Who this module is the deciding factor for. */
  bestFor: string;
  /** Honest limits. Trust converts better than a feature wall. */
  limits: string[];
  faq: FeatureFaq[];
  /** Related module slugs, for internal linking. */
  related: string[];
}

export const features: Feature[] = [
  {
    slug: "staff-scheduling",
    name: "Rota & scheduling",
    heading: "Staff scheduling built for venues that change the rota daily",
    title: "Restaurant Staff Scheduling Software | Rotahr",
    metaDescription:
      "Build a hospitality rota once, publish to staff phones, and handle swaps, availability and no-shows without a group chat. Flat monthly price, unlimited staff on Enterprise.",
    answer:
      "Rotahr's scheduling module lets you build a week's rota on one screen, publish it straight to your staff's phones, and absorb the swaps, sickness and last-minute cover that follow — without a single group-chat message.",
    body: [
      "Most scheduling tools were built for offices, where a rota is set once a quarter. Hospitality doesn't work that way. A Tuesday delivery runs late, a chef calls in sick, a twelve-cover booking turns into thirty, and the rota you published on Sunday is already wrong. The module is designed around that churn rather than pretending it isn't there.",
      "Staff see only what concerns them: their shifts, their hours, their swap requests. Managers see the whole week, the wage cost as it builds, and who has already been asked to cover. When a shift changes, the person affected gets a push notification — so nobody turns up to a shift that moved.",
      "Copy-week-to-week and shift templates mean a stable week takes about a minute to lay down, leaving your attention for the exceptions. Public holidays are flagged on the rota so premium pay never gets missed by accident.",
    ],
    capabilities: [
      {
        title: "Publish to phones, not to a noticeboard",
        detail:
          "Publishing sends a push notification to every affected member of staff. They can open the rota offline afterwards, so a bad signal in the cellar isn't an excuse.",
      },
      {
        title: "Swaps that route through you",
        detail:
          "Staff request a swap in the app; it lands as an approval, not as a message you have to scroll back to find. Nothing changes on the rota until you say so.",
      },
      {
        title: "Availability and time off in the same view",
        detail:
          "Approved time off and declared availability grey out on the rota grid, so you can't accidentally schedule someone who told you three weeks ago they were away.",
      },
      {
        title: "Wage cost as you build",
        detail:
          "The projected wage cost updates while you drag shifts, so you see a bad week before you publish it rather than at the end of the month.",
      },
      {
        title: "Late and no-show alerts",
        detail:
          "If someone hasn't clocked in a set number of minutes after their shift start, you get a notification. You find out during service, not during payroll.",
      },
      {
        title: "Multi-venue",
        detail:
          "Staff who work across two or three sites appear on both rotas with their combined hours visible, so cross-site double-booking and unplanned overtime surface early.",
      },
    ],
    bestFor:
      "Operators currently running the rota in a spreadsheet plus a WhatsApp group, where the real cost is not the spreadsheet but the twenty messages a day around it.",
    limits: [
      "There's no automated optimal-rota generator. Deciding who works Saturday night involves things software doesn't know, and a generated rota you have to unpick is slower than one you built.",
      "Demand forecasting from POS data is limited to venues with a connected POS. Without one, the wage-cost view is based on your rota, not on projected covers.",
    ],
    faq: [
      {
        q: "Do staff need to install an app?",
        a: "There's a mobile app for iOS and Android, but staff can also use Rotahr in a phone browser and install it to their home screen. Nobody is blocked from seeing their rota because of a phone.",
      },
      {
        q: "Does the price go up as I hire?",
        a: "Not within a plan. Pricing is a flat monthly fee per band — up to 15 staff, up to 30, or unlimited on Enterprise — rather than per user, so taking on four seasonal staff for the summer doesn't change your bill.",
      },
      {
        q: "Can I see who has already been asked to cover a shift?",
        a: "Yes. Cover requests and their responses stay attached to the shift, so you can see at a glance who declined rather than asking the same person twice.",
      },
    ],
    related: ["time-tracking-payroll", "haccp-food-safety"],
  },

  {
    slug: "haccp-food-safety",
    name: "HACCP & food safety",
    heading: "Paperless HACCP records an inspector can read in one tap",
    title: "HACCP App for Restaurants & Kitchens | Rotahr",
    metaDescription:
      "Digital temperature checks, delivery records, cleaning schedules and a corrective action log. Export a full HACCP pack as PDF for an inspection.",
    answer:
      "Rotahr replaces the paper food-safety diary with logged temperature checks, delivery records, cleaning checklists and a corrective action log, all exportable as a single PDF when an inspector walks in.",
    body: [
      "The paper diary fails in the same two ways everywhere. Either it isn't filled in, and you find out when an officer asks for six weeks of fridge temperatures. Or it's filled in perfectly at 4pm on a Friday for the whole week, which is worse, because it's a record of nothing.",
      "The module attacks that by moving the record to the phone of whoever is already standing in front of the fridge, and by chasing it. You set the times a check is due — say 08:00, 14:00 and 20:00, per day of the week — and a scheduled job notifies clocked-in staff when one is outstanding, re-reminding every fifteen minutes until it's logged. Each entry carries who logged it and when, which is exactly what an inspector is trying to establish.",
      "Every check type has its own form, because temperature isn't one number. Cooking records capture item, start and end time and core temperature, and flag a pass at 75°C or above. Cooling records capture start and end time and temperature, and calculate the use-by date automatically. Delivery records can be imported from the expense you already logged for that delivery, so the vehicle temperature and the invoice don't live in two places.",
      "When something fails, the corrective action log is the point. A fridge at 9°C is not a problem in itself; a fridge at 9°C with no record of what you did about it is. The log ties the failed reading to the action taken and who took it.",
    ],
    capabilities: [
      {
        title: "Your actual equipment, named",
        detail:
          "Build the equipment list per venue — 'Kitchen fridge 2', 'Bar under-counter', 'Hot hold pass' — so a check is against a real unit rather than a generic slot.",
      },
      {
        title: "Editable checklists",
        detail:
          "Opening, closing, daily, weekly and deep-clean checklists are all editable. Add, remove and reorder tasks to match how your kitchen actually closes down; the defaults are a starting point, not a straitjacket.",
      },
      {
        title: "Cooking and cooling with the thresholds built in",
        detail:
          "Core temperature at or above 75°C passes a cooking record. A cooling record's use-by date is calculated from the end time rather than remembered.",
      },
      {
        title: "Delivery checks from a photo",
        detail:
          "Photograph the delivery note and it populates the delivery check, the expense and your stock levels at once, rather than being typed three times.",
      },
      {
        title: "Reminders that follow the shift",
        detail:
          "Due checks notify staff who are clocked in or on a published shift — not the whole team, and not the manager on a day off.",
      },
      {
        title: "One-tap inspection pack",
        detail:
          "Export the full period as a PDF: every check, every reading, every corrective action, with names and timestamps.",
      },
    ],
    bestFor:
      "Kitchens that have been served an improvement notice, or any operator who has ever had to admit the diary is three weeks behind.",
    limits: [
      "Rotahr records checks; it doesn't read your fridges. There's no Bluetooth probe or IoT sensor integration, so a temperature is a number a human enters.",
      "The system can prove a check was logged at a given time by a given person. It cannot prove the reading was honest — no software can.",
      "The forms follow HACCP principles and common inspection expectations rather than any single country's statutory template. Check the export against your local authority's requirements before you rely on it.",
    ],
    faq: [
      {
        q: "Will this satisfy an environmental health inspection?",
        a: "The export gives an inspector what they normally ask for: a dated, attributed record of temperature checks, deliveries, cleaning and corrective actions across the period. Requirements vary by authority, so review the export against your local checklist rather than assuming.",
      },
      {
        q: "Who can log a check?",
        a: "Any role can log checks — that's the point, since the person at the fridge is rarely a manager. Only managers and admins can delete a logged check, so the record can't be quietly tidied up.",
      },
      {
        q: "What happens if a check is missed?",
        a: "It stays outstanding and keeps reminding rather than disappearing. A gap in the record is visible instead of silent, which is what lets you fix it the same day.",
      },
    ],
    related: ["stock-recipe-costing", "bookkeeping-receipts"],
  },

  {
    slug: "table-bookings",
    name: "Bookings & floor plan",
    heading: "Table bookings on your real floor plan, not a list",
    title: "Restaurant Table Booking System | Rotahr",
    metaDescription:
      "Take reservations, assign them to your actual table layout, and see tonight's floor at a glance. Guest history builds automatically.",
    answer:
      "Rotahr takes reservations through your own public booking page and puts them on a drag-and-drop plan of your actual dining room, so you can see what's free tonight without reading a list and translating it in your head.",
    body: [
      "A reservation list tells you that eight bookings exist. It doesn't tell you whether the 19:30 six-cover fits anywhere, which is the only question that matters when the phone is ringing. The floor plan tab exists to answer that in one glance.",
      "You build the room once: square, round and rectangular tables, a bar counter, each with its own capacity, dragged into position and resized until the canvas matches the room. From then on the plan is colour-coded by status for whatever date you're looking at. Click an empty table and you get a new booking pre-assigned to it. Click an occupied one and you get the reservation behind it.",
      "Reservations feed the guest database automatically, so the regular who books every second Thursday accumulates a visit count, a no-show count and whatever notes your team has added, without anyone maintaining a separate list.",
      "The AI booking assistant handles the requests that arrive as sentences rather than as forms, pulling the date, time and party size out and proposing a slot for you to confirm.",
    ],
    capabilities: [
      {
        title: "Visual floor plan",
        detail:
          "Add tables in four shapes with individual capacities, drag them into position and resize on canvas. Status colours update per selected date.",
      },
      {
        title: "Click-to-book",
        detail:
          "Clicking a free table opens a new booking already assigned to it. Clicking a taken one opens the reservation, so you're never searching a list for a name you can see on screen.",
      },
      {
        title: "Public booking page",
        detail:
          "Each venue gets a public page where guests book directly. It also carries your specials and menu, so the page doing the booking is the page doing the selling.",
      },
      {
        title: "Guest history without data entry",
        detail:
          "Reservations build customer profiles automatically — visits, no-shows, tags and manager notes — which is what turns a booking system into something you can market from.",
      },
      {
        title: "No-show tracking",
        detail:
          "No-shows are recorded against the guest, so a pattern is visible before you hold a Saturday table for someone for the fourth time.",
      },
      {
        title: "Booking-led staffing prompts",
        detail:
          "When bookings for a date pass a threshold you set, the AI assistant suggests increasing cover on the rota for that shift.",
      },
    ],
    bestFor:
      "Venues taking bookings by phone and diary who keep double-booking the one big table, and anyone whose reservations and marketing list have never been connected.",
    limits: [
      "There's no integration with third-party reservation marketplaces, so bookings that arrive via an aggregator have to be entered.",
      "Table combining is manual — you assign the party to tables yourself rather than the system merging two-tops automatically.",
      "Deposits and card holds aren't supported. A no-show costs you the cover, and the record of it, not a charge.",
    ],
    faq: [
      {
        q: "Can guests book without calling?",
        a: "Yes — each venue gets a public booking page you can link from your site, Instagram bio or a QR code on the table.",
      },
      {
        q: "Does the floor plan have to match my room exactly?",
        a: "It's worth the ten minutes to make it close. Once the shapes and positions resemble the actual room, staff read the plan instinctively rather than decoding it.",
      },
      {
        q: "What happens to guest data under GDPR?",
        a: "Marketing email is gated on consent, reservations can be anonymised, and the customer record supports GDPR anonymisation and export rather than only deletion.",
      },
    ],
    related: ["guest-crm", "staff-scheduling"],
  },

  {
    slug: "bookkeeping-receipts",
    name: "Bookkeeping & receipts",
    heading: "Photograph a receipt and it files itself",
    title: "Restaurant Bookkeeping & Receipt Scanning | Rotahr",
    metaDescription:
      "Snap a receipt or delivery note and AI reads the vendor, date, total and tax. Category totals, P&L, tax summary and CSV export for your accountant.",
    answer:
      "Photograph a receipt in Rotahr and it reads the vendor, date, line items, total and tax for you, presents them for a quick correction, and files the expense — so the shoebox never happens.",
    body: [
      "Bookkeeping in a small venue fails for a boring reason: entering receipts is a twenty-minute job that has to happen every day, and it competes with service. Push it to the end of the month and you're reconstructing a month from a carrier bag, guessing at categories, and giving your accountant something they have to charge you to untangle.",
      "The module removes the typing. You take a photo, AI extracts the fields, and you correct anything it read wrong before saving — it's a draft you approve, not a black box you hope about. Delivery notes go further: one photo populates the expense, updates stock levels, and completes the HACCP delivery check at the same time.",
      "The dashboard is where it pays back. Category totals, monthly and weekly views, a P&L, a tax summary and per-employee cost — meaning you can see food cost as a percentage moving before it's a problem, rather than in a set of accounts nine months later.",
      "Tax labelling follows your currency: VAT in Ireland and the UK, sales tax in the US, GST/HST in Canada, GST in Australia. The numbers and the wording match the jurisdiction you're actually operating in.",
    ],
    capabilities: [
      {
        title: "AI reading you can correct",
        detail:
          "Extracted vendor, date, total and tax appear as an editable draft. Nothing is saved until you've looked at it.",
      },
      {
        title: "One scan, three places",
        detail:
          "A delivery note photo populates bookkeeping, stock and the HACCP delivery check together, instead of the same delivery being entered three times.",
      },
      {
        title: "Full expense categories",
        detail:
          "Food, drink, wages, rent, utilities, repairs and the rest, so category totals mean something rather than everything landing in 'general'.",
      },
      {
        title: "P&L and tax summary",
        detail:
          "Monthly and weekly P&L views plus a tax summary, built from the expenses as they're entered.",
      },
      {
        title: "Per-employee cost",
        detail:
          "Labour cost broken down by person, which is the number behind most bad weeks and the one spreadsheets hide.",
      },
      {
        title: "CSV export",
        detail:
          "Export the period for your accountant or bookkeeper, so their time goes on advice rather than on data entry.",
      },
    ],
    bestFor:
      "Owner-operators doing their own books, and anyone whose accountant has ever asked for 'the receipts' and been handed a bag.",
    limits: [
      "This isn't a full accounting package. There's no double-entry ledger, no bank feed reconciliation and no direct tax filing — it's the expense capture and cost visibility layer, and the CSV export is the handover point.",
      "AI extraction is very good on printed receipts and ordinary delivery notes, and less good on faded thermal paper and handwriting. That's why every read is editable before saving.",
      "Receipt images are purged on a schedule once the expense data is captured, so the images aren't a permanent archive.",
    ],
    faq: [
      {
        q: "Does it work with my accounting software?",
        a: "Via CSV export rather than a live sync. Most bookkeepers would rather have a clean categorised CSV than another integration to police.",
      },
      {
        q: "Who can see the books?",
        a: "Managers and admins only. Bookkeeping is not visible to general staff.",
      },
      {
        q: "Can I use it outside Ireland?",
        a: "Yes — EUR, USD, GBP, CAD and AUD are supported, and the tax label changes to match the jurisdiction rather than saying 'VAT' at an American operator.",
      },
    ],
    related: ["stock-recipe-costing", "haccp-food-safety"],
  },

  {
    slug: "time-tracking-payroll",
    name: "Clock-in & payroll",
    heading: "Clock-in that turns into payroll hours without retyping",
    title: "Staff Clock-In & Payroll Hours App | Rotahr",
    metaDescription:
      "Phone-based clock in and out, break tracking with legal thresholds, and hours that flow straight into a payroll summary. No more adding up a paper sheet.",
    answer:
      "Staff clock in and out on their phone, breaks are tracked against the legal thresholds, and the resulting hours flow into a payroll summary — so nobody adds up a paper timesheet at midnight on the last day of the month.",
    body: [
      "The gap between the rota and the payslip is where money leaks. A shift rostered 17:00–23:00 that actually ran to 23:40 either gets paid from memory or doesn't get paid. Multiply that by twenty staff and a month, and the difference is real in both directions.",
      "Clock-in closes the gap by recording what happened rather than what was planned, and by keeping both numbers so you can see the drift. Rostered hours, actual hours and the variance sit side by side.",
      "Breaks are treated as an entitlement rather than an afterthought. Staff mark a break started and ended from the clock page. Under Irish working time rules that means a 15-minute break past four and a half hours and 30 minutes past six; the app shows an amber banner when a break is due, pushes a notification when the threshold is crossed, and a scheduled job re-sends the reminder even if the app is closed. The record is then evidence the break was offered and taken.",
      "The payroll view aggregates hours by person and period with the break deductions already applied, ready to hand to whoever runs your payroll. If you run a tronc, tips are tracked and distributed separately from wages so the two never get muddled.",
    ],
    capabilities: [
      {
        title: "Clock in and out on a phone",
        detail:
          "No hardware terminal to buy, mount or replace. Staff use the app or the browser.",
      },
      {
        title: "Break entitlement tracking",
        detail:
          "On Break / End Break with the Irish statutory thresholds built in, an amber banner when one is due, and a server-side reminder that fires even with the app closed.",
      },
      {
        title: "Rostered vs actual",
        detail:
          "Both figures kept, so overrun is visible as a pattern rather than argued about one shift at a time.",
      },
      {
        title: "Payroll summary",
        detail:
          "Hours per person per period with breaks deducted, ready to export to whoever processes the pay run.",
      },
      {
        title: "Tips and tronc",
        detail:
          "Tips recorded and distributed separately from wages, keeping the tronc distinct from payroll as it should be.",
      },
      {
        title: "Clock reminders",
        detail:
          "Push notifications to clock in and out, which is what stops the 'forgot to clock out' correction becoming a weekly ritual.",
      },
    ],
    bestFor:
      "Venues still adding up a paper time sheet, and any operator who has had a break-entitlement question they couldn't evidence an answer to.",
    limits: [
      "Rotahr produces payroll-ready hours; it is not a payroll bureau. It doesn't calculate PAYE, run submissions to a revenue authority, or pay anybody.",
      "There's no biometric or geofenced clock-in enforcement, so buddy-punching is deterred by visibility rather than prevented by hardware.",
      "The statutory break thresholds implemented are the Irish ones. Operators elsewhere still get break tracking and reminders, but should set expectations against their own local rules.",
    ],
    faq: [
      {
        q: "Can staff clock in from home?",
        a: "There's no geofence, so treat clock-in as a record rather than a lock. Rostered-vs-actual variance is what surfaces a problem in practice.",
      },
      {
        q: "Does it handle overtime rates?",
        a: "Hours and variance are tracked; how you pay them is set in your payroll. Rotahr shows you the hours and the cost, it doesn't decide the rate.",
      },
      {
        q: "What about public holidays?",
        a: "Public holidays are flagged on the rota so premium pay isn't missed when the rota is built.",
      },
    ],
    related: ["staff-scheduling", "bookkeeping-receipts"],
  },

  {
    slug: "stock-recipe-costing",
    name: "Stock & recipe costing",
    heading: "Know what a dish costs after your supplier raises prices",
    title: "Recipe Costing & Stock Control for Kitchens | Rotahr",
    metaDescription:
      "Recipe costing that updates itself from the last price you actually paid, plus stock levels fed by delivery note scanning. See margin move before it hurts.",
    answer:
      "Rotahr costs each recipe from the last price you actually paid for every ingredient, so when a supplier puts butter up, the gross margin on every dish using butter updates without anyone rebuilding a spreadsheet.",
    body: [
      "Most kitchens cost their menu once, when they write it, and never again. Then supplier prices move for eighteen months and the dish everyone orders quietly stops making money. The spreadsheet that would have caught it needs a manual update per ingredient per price change, so it doesn't happen.",
      "Here the link is live. Each recipe reads the current stored price for its ingredients, and those prices update when a delivery is entered — including from a scanned delivery note. Costing therefore reflects what you paid last week rather than what you paid when the menu was designed.",
      "Recipes double as the kitchen's reference. Managers can attach a photo of the finished dish, so a new chef plating it on a Saturday sees what it's meant to look like instead of guessing, which is a specification problem as much as a costing one.",
      "Stock levels come from the same delivery entry, so one photo of a delivery note moves the expense, the stock and the HACCP record together.",
    ],
    capabilities: [
      {
        title: "Live ingredient pricing",
        detail:
          "Recipes read the last price paid per stock item, so a supplier increase flows through to every affected dish automatically.",
      },
      {
        title: "Delivery note scanning",
        detail:
          "One photo reads vendor, date and line items, then updates stock, the expense and the HACCP delivery check.",
      },
      {
        title: "Dish photos for plating",
        detail:
          "Attach a photo of the finished plate to each recipe. Kitchen staff see it on the recipe card, which keeps presentation consistent across shifts.",
      },
      {
        title: "Gross margin per dish",
        detail:
          "Cost against menu price per dish, so the menu engineering conversation starts from numbers.",
      },
      {
        title: "Stock levels",
        detail:
          "Current levels per item, fed by deliveries rather than by a separate stocktake ritual.",
      },
    ],
    bestFor:
      "Kitchens on a fixed menu who haven't re-costed since supplier prices moved, and anyone whose food cost percentage is a surprise every month.",
    limits: [
      "Depletion isn't automatic unless a POS is connected — stock goes up on delivery, but sales-driven depletion needs the POS link or a periodic count.",
      "Yield and wastage factors are simple. A recipe that loses 40% of its weight in trim needs that reflected in the quantities you enter.",
      "It isn't a full inventory system with par levels and automatic purchase orders.",
    ],
    faq: [
      {
        q: "Do I have to enter every ingredient price by hand?",
        a: "Only the first time. After that, delivery entry — including scanned delivery notes — keeps prices current.",
      },
      {
        q: "Can I see which dishes stopped being profitable?",
        a: "Yes. Because costs update from real prices, margin per dish moves on its own and the losers become visible.",
      },
      {
        q: "Does it work without a POS?",
        a: "Yes for costing and delivery-fed stock. Sales-driven depletion is where a connected POS adds real value.",
      },
    ],
    related: ["bookkeeping-receipts", "haccp-food-safety"],
  },

  {
    slug: "guest-crm",
    name: "Guest CRM",
    heading: "A guest database that builds itself from your bookings",
    title: "Restaurant CRM & Guest Database | Rotahr",
    metaDescription:
      "Customer profiles created automatically from reservations: visit history, spend, no-shows, tags and notes. Loyalty tiers and points, consent-gated campaigns, CSV export, duplicate merging.",
    answer:
      "Every reservation in Rotahr creates or updates a guest profile automatically, so you end up with a real customer database — visit counts, spend, no-shows, tags and notes — without anybody maintaining a list, and loyalty tiers and points sit on top of it.",
    body: [
      "Most independent venues have no idea who their regulars are, in the sense of being able to name them or reach them. The information exists, spread across a booking diary, a card machine and the memory of whoever is on the door. It's never in one place, so it's never used.",
      "Because profiles are built from bookings you're already taking, the database is a by-product rather than a project. Search and filter by tag, see visit statistics and no-show history, and add the manager notes that make a returning guest feel recognised — the allergy, the usual table, the anniversary.",
      "Email is deliberately consent-gated. You can send to guests who have opted in, and the ones who haven't are excluded rather than quietly included. Duplicate profiles can be merged, and a guest can be anonymised on request in a way that satisfies a deletion request without shredding your booking history.",
      "On top of the profiles sit loyalty and campaigns. Spend recorded against a guest — entered by hand or imported from a CSV — drives visit counts, average spend and a tier: Bronze, Silver, Gold, and VIP once lifetime spend passes your threshold. Points accrue per unit spent and staff redeem them at the till against a value you set. Campaigns build a list from a segment — lapsed regulars, birthdays this month, VIPs — and queue as a draft for a human to read before anything leaves the building. Nothing sends on its own.",
    ],
    capabilities: [
      {
        title: "Automatic profile building",
        detail:
          "Reservations create and update customer records, and existing reservations can be backfilled into profiles when you start.",
      },
      {
        title: "Visit and no-show statistics",
        detail:
          "Visit counts and no-show history per guest, which is both a marketing signal and a Saturday-night decision aid.",
      },
      {
        title: "Tags and manager notes",
        detail:
          "Tag guests however your team thinks — regulars, allergies, VIP, corporate — and add notes staff can see before service.",
      },
      {
        title: "Consent-gated email",
        detail:
          "Send from within Rotahr to opted-in guests only, so a marketing send can't accidentally become a compliance problem.",
      },
      {
        title: "Merge and clean",
        detail:
          "Merge duplicates created by name variations and phone-number differences, so counts mean something.",
      },
      {
        title: "Spend history and averages",
        detail:
          "Per-guest transactions entered by hand or imported from a CSV, giving lifetime spend, average spend per visit and a favourite-dishes list.",
      },
      {
        title: "Loyalty tiers and points",
        detail:
          "Bronze, Silver and Gold on visit count, plus a VIP tier triggered by lifetime spend, with points earned per unit spent and redeemed at the till at a value you set. Thresholds and point value are yours to change.",
      },
      {
        title: "Campaigns with a draft review queue",
        detail:
          "Build a list from a segment — lapsed regulars, birthdays this month, VIPs, no-show risks — and the campaign is queued as a draft for someone to read and approve. Nothing is sent autonomously.",
      },
      {
        title: "GDPR handling",
        detail:
          "Anonymisation and CSV export, so deletion and access requests have an answer that isn't manual.",
      },
    ],
    bestFor:
      "Venues with a busy diary and no marketing list, and anyone who has wanted to fill a quiet Tuesday and had no one to tell.",
    limits: [
      "It's not a marketing automation platform. Campaigns are queued as drafts for a human to approve, and there are no drip sequences and no A/B testing — deliberately, because an unsupervised send to a guest list is how venues get themselves in trouble.",
      "Guest spend has no automatic feed from the till. Transactions are entered by hand or imported from a CSV; a connected POS gives you day-level sales, not who spent what.",
      "Guests who never book — walk-ins — don't create profiles, so a wet-led bar will see thinner coverage than a restaurant.",
      "Loyalty is points and tiers held in Rotahr and redeemed by a member of staff. There is no plastic card, no wallet pass and no self-serve guest login.",
    ],
    faq: [
      {
        q: "Do I need to import anything to start?",
        a: "No. Existing reservations can be backfilled into profiles, so the database has history from day one rather than starting empty.",
      },
      {
        q: "Can I email everyone in the database?",
        a: "Only guests who have consented. That's deliberate — a list you can legally email is worth more than a bigger one you can't.",
      },
      {
        q: "What if the same guest is in there twice?",
        a: "Merge the profiles. Visit history combines rather than one record being discarded.",
      },
      {
        q: "How does the loyalty scheme work?",
        a: "Guests move through Bronze, Silver and Gold on visit count, and into VIP on lifetime spend. Points accrue per unit spent and staff redeem them at the till against a value you set. Both the thresholds and the point value are configurable.",
      },
      {
        q: "Will a campaign send by itself?",
        a: "No. A campaign builds its list from a segment and then waits as a draft until somebody approves it. That is deliberate.",
      },
    ],
    related: ["table-bookings", "bookkeeping-receipts"],
  },

  {
    slug: "training-certifications",
    name: "Training & Certifications",
    heading: "In-house training built from your own menu, equipment and logs",
    title: "Staff Training & Certification Tracking | Rotahr",
    metaDescription:
      "Thirteen in-house training courses generated from your own menu, equipment register, stock list and HACCP records. 80% pass mark, 12-month expiry, printable record. Not accredited.",
    answer:
      "Rotahr builds thirteen short training courses out of your venue's own data — your menu, your equipment register, your stock list, your HACCP units, your rota — so a new starter is tested on the actual allergens and the actual fridges they will work with, and every pass is recorded with an expiry date. This is in-house training, not an accredited qualification.",
    body: [
      "Induction training in a small venue is usually a conversation on a Tuesday afternoon that nobody writes down. The generic e-learning alternative teaches a fictional kitchen: a menu that isn't yours, equipment you don't own, chemicals you don't stock. Staff click through it, the certificate goes in a drawer, and nothing about how your venue actually runs has been learned or evidenced.",
      "Because Rotahr already holds the menu and its allergen matrix, the stock list, the cleaning logs, the delivery log, the HACCP units and the equipment register, the course content is generated from them. The allergen course asks about dishes on your own menu. The fire safety course names your own equipment. The working time course follows the rule set for your region. Change the menu and the course changes with it.",
      "Assign a course to one person or the whole team, then use the team board — every staff member against every course in one grid — to see who to chase first. A pass needs 80%, lasts twelve months, prints as a certificate, and sits on that employee's profile beside their external certificates so the expiry tracker chases it before it lapses. An owner without a staff record can take any course too, marked as a practice run so it stays out of the team's records.",
    ],
    capabilities: [
      {
        title: "Thirteen courses, generated from your data",
        detail:
          "Allergen awareness from your menu, fire safety from your equipment register, manual handling from your stock list, food hygiene and HACCP system awareness from your own HACCP units, cleaning chemical safety from your cleaning logs, deliveries and goods-in from your delivery log, guest data privacy from your guest records, working time and breaks from your rota, plus front-of-house allergen service, knife and equipment safety, stock and waste cost, and opening and closing checks.",
      },
      {
        title: "Assign and chase",
        detail:
          "Assign to one person or the whole team with a due date, and outstanding assignments get chased rather than remembered by a manager.",
      },
      {
        title: "Team board",
        detail:
          "Every staff member against every course in a single grid, so the gaps and the people to chase first are visible without opening thirteen reports.",
      },
      {
        title: "Pass mark and 12-month expiry",
        detail:
          "80% to pass, valid for twelve months, then it reappears as due. Retakes are allowed and the latest result is the one that counts.",
      },
      {
        title: "Printable certificate",
        detail:
          "Each pass produces a certificate you can print or save as a PDF for the training folder an inspector asks to see.",
      },
      {
        title: "History on the employee profile",
        detail:
          "Which courses a person has taken, when they passed and when it expires, alongside the external certificates Rotahr already tracks.",
      },
    ],
    bestFor:
      "Venues that induct staff constantly and have nothing written down to prove any of it, and anyone whose training records are currently a drawer.",
    limits: [
      "This is in-house training, not an accredited qualification. Rotahr is not an awarding body and these courses carry no accreditation. Where your jurisdiction requires accredited or externally certified training, you still buy that separately — Rotahr records it and tracks its expiry, it does not replace it.",
      "Course content is only as good as the data behind it. A half-filled allergen matrix or an empty equipment register produces a thin course.",
      "Text and questions only. No video, no SCORM and no library of third-party courses.",
      "Written for the jurisdictions Rotahr supports — Ireland, the UK, the US, Canada and Australia — and not a substitute for local legal advice.",
    ],
    faq: [
      {
        q: "Is the training accredited?",
        a: "No. These are in-house courses built from your own data, and Rotahr is not an awarding body. They evidence that you trained your team on your own systems. They do not replace an accredited qualification where one is legally required.",
      },
      {
        q: "Will it satisfy an inspector?",
        a: "It gives you what most small venues cannot produce on the spot: a dated record of who was trained on what, with a pass mark and a printable certificate. Whether that is sufficient depends on your jurisdiction and the role. For anything that requires accredited certification, keep buying it and record it in Rotahr alongside.",
      },
      {
        q: "What happens after twelve months?",
        a: "The pass expires and the course reappears as due for that person, exactly the way an external certificate expiry is tracked.",
      },
      {
        q: "Can I take a course myself as the owner?",
        a: "Yes. An owner without a staff record can take any course, and the attempt is marked as a practice run so it never lands in the team's records.",
      },
    ],
    related: ["haccp-food-safety", "staff-scheduling"],
  },

  {
    slug: "equipment-register",
    name: "Equipment & Service Register",
    heading: "Every asset, its service history and its paperwork in one place",
    title: "Equipment & Service Register for Venues | Rotahr",
    metaDescription:
      "Log every asset with purchase price, warranty, service interval and documents. Warnings 30 and 7 days before a service, warranty or replacement date, plus a Monday morning digest.",
    answer:
      "Rotahr keeps a register of every piece of equipment in the venue — what it is, where it lives, what it cost, who to ring, when it was last serviced and when it is next due — with the certificates and invoices attached, and it warns you 30 days and 7 days before anything falls due.",
    body: [
      "The gas interlock certificate, the extraction clean, the cellar cooler service, the coffee machine warranty. Every venue has a dozen of these and no system for them. They live in an email, a folder behind the office door, or the memory of whoever rang the engineer last time. Losing track costs you either an unplanned closure or a callout invoice for something that was still under warranty.",
      "The register lives inside the Log Book, so an asset that has broken and an asset that is due a service sit where a manager already looks every shift. Each asset carries its make, model and serial number, where it is, purchase date and price, warranty provider and expiry, the engineer's company and phone number, a service interval, and a replace-by date — because a machine can be perfectly serviced and still need budgeting for.",
      "Every visit is logged against the asset: what kind of visit it was, who came, what they did, what it cost and whether the warranty covered it, with the service report or invoice uploaded to the record. Logging a service rolls the next due date forward by the interval, and a one-off date an engineer books survives instead of being overwritten. Warnings arrive 30 and 7 days out, a digest lands every Monday morning with what is due that week, and costs display in your own currency from your business settings.",
    ],
    capabilities: [
      {
        title: "Asset register",
        detail:
          "Name, category, location, make, model and serial number, purchase date and price, and a status: active, faulty, awaiting parts, out of service or retired.",
      },
      {
        title: "Warranty and who to ring",
        detail:
          "Warranty provider, expiry and notes alongside the service company, contact name, phone and email, so nobody pays for a callout that was covered.",
      },
      {
        title: "Service history",
        detail:
          "Every service, repair, inspection, installation and callout against the asset: date, engineer, company, cost, whether it was under warranty, and what was actually done.",
      },
      {
        title: "Documents and certificates",
        detail:
          "Warranties, invoices, service reports, manuals and photos uploaded to the asset or to a specific visit, held in private storage and streamed only to your own team.",
      },
      {
        title: "30 and 7 day advance warnings",
        detail:
          "Service dates, warranty expiries and replace-by dates each warn twice, far enough ahead to book an engineer rather than react to a breakdown.",
      },
      {
        title: "Monday morning digest",
        detail:
          "A weekly summary of what is due, so the week gets planned before service starts rather than after something fails.",
      },
    ],
    bestFor:
      "Kitchens and cellars full of equipment on service contracts, and any operator who has paid for a callout that a warranty would have covered.",
    limits: [
      "It reminds you, it does not book the engineer. There is no contractor marketplace, no job dispatch and no link into a service company's diary.",
      "Not fixed-asset accounting. Purchase price and warranty are recorded, but Rotahr does not calculate depreciation or post an asset ledger into the bookkeeping module.",
      "No barcode or QR asset scanning, and no wired temperature probes — fridge temperatures are logged in the HACCP module by a person.",
      "Service intervals are yours to set. Rotahr does not know the manufacturer's recommended schedule for your specific machine.",
    ],
    faq: [
      {
        q: "Where does the register live?",
        a: "Inside the Log Book, next to the faults and repairs staff already report, so a broken machine and a machine due a service are in one place.",
      },
      {
        q: "How far ahead does it warn me?",
        a: "Thirty days and again seven days before a service, warranty expiry or replace-by date, plus a digest every Monday morning with the week ahead.",
      },
      {
        q: "Can I store the certificates in it?",
        a: "Yes. Warranties, invoices, service reports, manuals and photos attach to the asset or to a specific visit, and are held in private storage rather than behind a public link.",
      },
      {
        q: "Does logging a service update the next due date?",
        a: "It rolls forward by the service interval automatically, and if an engineer books a one-off date that does not match the interval, that date is kept.",
      },
    ],
    related: ["haccp-food-safety", "bookkeeping-receipts"],
  },
];

export function getFeature(slug: string) {
  return features.find((f) => f.slug === slug);
}
