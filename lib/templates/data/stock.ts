import type { FreeTemplate } from "../types";

export const stockTemplates: FreeTemplate[] = [
  {
    slug: "stock-count-sheet",
    category: "stock",
    name: "Stock count sheet",
    h1: "Free stock count sheet template",
    title: "Free Stock Count Sheet Template | Rotahr",
    metaDescription:
      "Free stock count sheet template for restaurants and bars. Printable PDF and Excel with unit, count, unit cost and value columns, organised by storage area.",
    answer:
      "This free stock count sheet template — printable PDF or editable Excel — is organised by storage area with columns for unit, opening count, closing count, unit cost and value, so the count matches the order you physically walk the site.",
    body: [
      "Stock counts go wrong for a mechanical reason, not a mathematical one: the sheet is in a different order to the shelves. Counting a sheet listed alphabetically means walking the dry store six times and guessing at the end. Organise the sheet by area — walk-in, freezer, dry store, bar, cellar — in the order you physically walk it, and the count takes half the time and is materially more accurate.",
      "Fix the unit before you count anything. \"Tomatoes: 4\" is meaningless — four tins, four kilos, four cases? The unit column exists to be filled in once and then never argued about again, and it should match the unit your supplier invoices in so the cost column reconciles without conversion.",
      "Count with two people where you can: one counting, one writing. It is faster than one person doing both and it removes the single most common error, which is writing a number in the row above or below the one you counted.",
      "Count at the same point in the cycle every time — after close, before any delivery, on the same day of the week. A count taken on Tuesday morning and compared against one taken on Friday night tells you nothing about usage. The Excel version carries opening and closing columns and a value total so the same sheet gives you a period usage figure.",
    ],
    sheet: {
      kind: "log",
      orientation: "landscape",
      headerFields: ["Venue / site", "Count date and time", "Counted by", "Checked by"],
      columns: [
        { name: "Storage area", hint: "Walk-in / freezer / dry / bar / cellar", width: 2 },
        { name: "Item", width: 5 },
        { name: "Unit", hint: "kg / L / case / each — match the invoice", width: 2 },
        { name: "Opening count", width: 1 },
        { name: "Closing count", width: 1 },
        { name: "Unit cost", width: 2 },
        { name: "Value", hint: "Closing count x unit cost", width: 2 },
      ],
      extraColumns: [
        { name: "Purchases in period", width: 2 },
        { name: "Usage", hint: "Opening + purchases − closing", width: 2 },
        { name: "Par level", width: 1 },
        { name: "Order qty", width: 1 },
      ],
      rowCount: 20,
      footerNotes: [
        "List items in the order you walk the site, not alphabetically. The sheet should follow the shelves.",
        "Set the unit to match the unit your supplier invoices in, so cost and value need no conversion.",
        "Count at the same point in the cycle every period — after close, before any delivery — or your usage figures mean nothing.",
      ],
    },
    howToUse: [
      "Build your item list once, grouped by storage area in the order you physically walk it.",
      "Fix the unit for every item and write it in before the first count.",
      "Fill the unit cost column from your most recent invoices, and update it when prices change.",
      "Count after close and before any delivery, with one person counting and one writing.",
      "Enter the closing count, let the value column give you the stock on hand, and total the sheet.",
      "Have a second person spot-check the highest-value lines, then sign the sheet.",
    ],
    whatsIncluded: [
      "Printable PDF, landscape A4, 20 item rows per sheet",
      "Excel (.xlsx) version with purchases, usage, par level and order quantity columns",
      "CSV version for import",
      "Storage area column so the sheet follows the shelves",
      "Unit and unit cost columns for a value total that reconciles with invoices",
      "Counted-by and checked-by fields for a second pair of eyes",
    ],
    faqs: [
      {
        q: "How often should a restaurant count stock?",
        a: "Weekly for high-value and fast-moving lines, and a full count monthly at minimum. The interval matters less than the consistency — always at the same point in the cycle, after close and before a delivery.",
      },
      {
        q: "How do I calculate stock usage from a count sheet?",
        a: "Opening count plus purchases in the period minus closing count. The Excel version has all three columns and a usage column, so you get the figure without a separate calculation.",
      },
      {
        q: "Should stock be counted at cost or at sale price?",
        a: "At cost. Stock on hand is a cost figure, and valuing it at sale price overstates it. Keep the unit cost column up to date from your most recent invoices.",
      },
      {
        q: "Why does my count never match the system?",
        a: "The usual causes are wastage that was never logged, staff food and drinks, over-portioning, transfers between sites or bars, and unit mismatches between the count sheet and the invoice. Log wastage separately and check your units before assuming theft.",
      },
    ],
    related: ["par-level-order-sheet", "wastage-log", "spirit-stocktake-sheet"],
    keywords: [
      "free stock count sheet template",
      "restaurant stocktake template excel",
      "inventory count sheet pdf free",
      "bar stock count sheet template",
    ],
  },
  {
    slug: "wastage-log",
    category: "stock",
    name: "Wastage log",
    h1: "Free food and drink wastage log template",
    title: "Free Food Wastage Log Template | Rotahr",
    metaDescription:
      "Free food and drink wastage log template in PDF and Excel. Records item, quantity, reason, cost and who signed it off so you can see where the money is actually going.",
    answer:
      "This free wastage log template — printable PDF or editable Excel — records what was thrown, how much, why, what it cost and who signed it off, so the reason column tells you which problem to fix rather than just how much you lost.",
    body: [
      "The number on a wastage log is much less useful than the reason beside it. Two hundred euro of waste in a week caused by over-prep is a forecasting problem; the same figure caused by spoilage is a rotation or ordering problem; caused by returns, it is a kitchen consistency problem. Without a reason column you learn only that you are losing money, which you already knew.",
      "Make it easy to log and it gets logged. That means a sheet on the wall beside the bin, not a form in the office, and short reason codes rather than a sentence. Every venue with an unrealistically clean waste log has staff quietly binning things instead of walking to the office.",
      "Separate the categories that are actually different problems: prep waste, spoilage, over-production, wrong order, customer return, breakage, staff food and drink, and comped items. Bundling comps into food waste hides both — you cannot see whether you have a kitchen problem or a service problem.",
      "Cost it at cost price and total it weekly against your food or beverage cost percentage. A waste figure with no comparison is noise. The same figure expressed as a share of sales is the number that gets attention, and it is the number that shows whether last month's fix worked.",
    ],
    sheet: {
      kind: "log",
      orientation: "landscape",
      headerFields: ["Venue / site", "Week commencing", "Manager sign-off"],
      columns: [
        { name: "Date", width: 1 },
        { name: "Time", width: 1 },
        { name: "Item wasted", width: 4 },
        { name: "Qty", hint: "With unit", width: 1 },
        { name: "Reason code", hint: "PREP / SPOIL / OVER / ORDER / RETURN / BREAK / STAFF / COMP", width: 3 },
        { name: "Detail", hint: "What actually happened", width: 4 },
        { name: "Cost", width: 1 },
        { name: "Initials", width: 1 },
      ],
      extraColumns: [
        { name: "Section", hint: "Kitchen / bar / FOH", width: 2 },
        { name: "Preventable?", hint: "Y / N", width: 1 },
        { name: "Action taken", width: 3 },
      ],
      rowCount: 20,
      footerNotes: [
        "Reason codes: PREP prep trim, SPOIL out of date or spoiled, OVER over-produced, ORDER wrong order made, RETURN customer sent it back, BREAK breakage, STAFF staff food or drink, COMP comped to a guest.",
        "Cost at cost price, not menu price, and total the sheet weekly against sales.",
        "Keep the sheet where the waste happens. A log in the office is a log nobody fills in.",
      ],
    },
    howToUse: [
      "Put the sheet on the wall beside the main bin and the bar waste point.",
      "Log every item as it is thrown, with the time, quantity and a reason code.",
      "Write one line of detail — that is what tells you whether it was preventable.",
      "Cost each line at cost price, using your most recent invoice figures.",
      "Total the sheet weekly and express it as a percentage of sales for the same period.",
      "Pick the single biggest reason code each week and change one thing about it, then check next week's sheet.",
    ],
    whatsIncluded: [
      "Printable PDF, landscape A4, 20 rows per week",
      "Excel (.xlsx) version with section, preventable and action columns",
      "CSV version for import",
      "Eight reason codes printed on the sheet, covering food and drink",
      "Cost column for a weekly total you can compare against sales",
      "Initials on every line and a weekly manager sign-off",
    ],
    faqs: [
      {
        q: "What counts as food waste in a restaurant?",
        a: "Anything that leaves stock without being sold: prep trim, spoiled or out-of-date stock, over-production, wrongly made orders, customer returns, breakages, staff food and comped items. Log them under separate reason codes — they are different problems with different fixes.",
      },
      {
        q: "How do I reduce food waste in a kitchen?",
        a: "Log it with reasons first, then fix the largest code. Over-production usually points at prep quantities set by habit rather than forecast; spoilage points at rotation, labelling or over-ordering; returns point at consistency or portioning on one section.",
      },
      {
        q: "Should comps and staff food go on the wastage log?",
        a: "Record them, but under their own codes. They are a real cost and belong in the total, but mixing them into food waste hides whether your problem is in the kitchen or in service.",
      },
      {
        q: "Do we cost waste at menu price or cost price?",
        a: "Cost price. Menu price inflates the figure and makes it easy to dismiss as unrealistic — and the number you are trying to manage is what leaving stock actually cost you to buy.",
      },
    ],
    related: ["stock-count-sheet", "par-level-order-sheet", "daily-takings-sheet"],
    keywords: [
      "free food waste log template",
      "wastage sheet template restaurant",
      "kitchen waste log excel free",
      "bar wastage record template pdf",
    ],
  },
  {
    slug: "par-level-order-sheet",
    category: "stock",
    name: "Par level order sheet",
    h1: "Free par level order sheet template",
    title: "Free Par Level Order Sheet Template | Rotahr",
    metaDescription:
      "Free par level order sheet template in PDF and Excel. Set a par per item, count what you have, and the order quantity works itself out — organised by supplier.",
    answer:
      "This free par level order sheet template — printable PDF or editable Excel — lists items by supplier with a par level, a current count and an order quantity column, so ordering becomes subtraction instead of a judgement call.",
    body: [
      "Ordering by feel is what produces both a walk-in full of dying herbs and a Saturday with no chicken. A par level fixes it: for each item, decide the quantity that gets you comfortably to the next delivery, count what you have, and order the difference. The judgement happens once, when you set the par — not at seven in the morning with a supplier on the phone.",
      "Group the sheet by supplier, because that is how you place orders. One sheet, five supplier blocks, each with its own order day and cut-off time written at the top of the block. Cut-off times belong on the sheet — most late orders are late because whoever was ordering did not know the cut-off was eleven.",
      "Set pars from usage, not from instinct, and set them differently for the day of the week. A par that works for a Wednesday delivery covering two quiet days is the wrong par for a Friday delivery covering the weekend. The spreadsheet has separate weekday and weekend par columns for that reason.",
      "Review pars monthly and after any menu change. A par level nobody has revisited since a dish came off the menu is how you end up with a case of something the kitchen no longer uses arriving every week.",
    ],
    sheet: {
      kind: "log",
      orientation: "landscape",
      headerFields: ["Venue / site", "Order date", "Ordered by", "Delivery expected"],
      columns: [
        { name: "Supplier", width: 2 },
        { name: "Item", width: 5 },
        { name: "Unit", hint: "Match the invoice unit", width: 2 },
        { name: "Par level", hint: "What you want on hand", width: 1 },
        { name: "On hand", hint: "Counted now", width: 1 },
        { name: "Order qty", hint: "Par − on hand", width: 1 },
        { name: "Unit cost", width: 1 },
        { name: "Line total", width: 1 },
      ],
      extraColumns: [
        { name: "Weekend par", hint: "Higher par for a delivery covering the weekend", width: 1 },
        { name: "Order day / cut-off", width: 2 },
        { name: "Minimum order value", width: 1 },
        { name: "Notes", width: 3 },
      ],
      rowCount: 20,
      footerNotes: [
        "Order quantity is par minus on hand. If you are regularly overriding it, the par is wrong — change the par, not the order.",
        "Write each supplier's order day and cut-off time on the sheet. Most late orders are late because nobody knew the cut-off.",
        "Review pars monthly and after every menu change.",
      ],
    },
    howToUse: [
      "Group your items by supplier and write each supplier's order day and cut-off time at the top of their block.",
      "Set a par level per item from your actual usage between deliveries, plus a small buffer.",
      "Set a separate, higher par for any delivery that has to cover the weekend.",
      "Count on hand immediately before ordering — not from yesterday's figures.",
      "Order the difference between par and on hand, and total the sheet to check it against any minimum order value.",
      "Review the pars monthly, and every time the menu changes, using your usage figures from the stock count sheet.",
    ],
    whatsIncluded: [
      "Printable PDF, landscape A4, 20 item rows per sheet",
      "Excel (.xlsx) version with weekend par, cut-off time and minimum order value columns",
      "CSV version for import",
      "Supplier grouping so the sheet matches how you actually order",
      "Par, on hand and order quantity columns so ordering is subtraction",
      "Unit cost and line total columns to see the order value before you send it",
    ],
    faqs: [
      {
        q: "What is a par level in a restaurant?",
        a: "The quantity of an item you want on hand to comfortably reach the next delivery. You count what you have, subtract it from the par, and order the difference — so ordering stops depending on who is doing it.",
      },
      {
        q: "How do I set par levels?",
        a: "Use your usage between deliveries from a stock count, add a small buffer for a busy service, and set a higher par for any delivery covering a weekend. Then review monthly rather than treating the first figure as permanent.",
      },
      {
        q: "How is this different from a stock count sheet?",
        a: "A stock count values what you hold and gives you usage. A par sheet turns that usage into an order. They pair up: count weekly, and let the par sheet decide the order quantity.",
      },
      {
        q: "Why do I keep running out even with par levels set?",
        a: "Usually the par is set for an average week rather than a busy one, the count is taken from memory rather than the shelf, or a supplier's cut-off was missed so the delivery is a day late. All three are visible on this sheet once you use it consistently.",
      },
    ],
    related: ["stock-count-sheet", "wastage-log", "delivery-check-record"],
    keywords: [
      "free par level sheet template",
      "restaurant order sheet template excel",
      "par level ordering template pdf",
      "kitchen ordering sheet free download",
    ],
  },
];
