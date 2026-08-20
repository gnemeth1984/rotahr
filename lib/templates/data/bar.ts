import type { FreeTemplate } from "../types";

export const barTemplates: FreeTemplate[] = [
  {
    slug: "cellar-check-line-cleaning-log",
    category: "bar",
    name: "Cellar check & line cleaning log",
    h1: "Free cellar check and beer line cleaning log template",
    title: "Free Beer Line Cleaning Log Template | Rotahr",
    metaDescription:
      "Free cellar check and beer line cleaning log template in PDF and Excel. Records cellar temperature, gas, line cleans by date, chemical used and who signed off.",
    answer:
      "This free cellar check and beer line cleaning log template — printable PDF or editable Excel — records daily cellar temperature and gas checks alongside every line clean, with the date, lines cleaned, chemical used and initials.",
    body: [
      "Beer quality complaints are almost always answered from this sheet. When a brewery rep or a quality auditor asks when the lines were last cleaned, \"about a week ago\" is not an answer — a dated log with initials and the chemical used is. It also protects you the other way: if the log is complete and the beer is still off, the problem is upstream and you can prove it.",
      "Cellar temperature is the check most often skipped and the one that costs the most. A cellar drifting a few degrees above target shortens the life of every cask in it and changes how the beer pours, and by the time anyone notices in the glass the stock is already affected. One reading a day, written down, catches it in a week rather than a month.",
      "Log gas as a level and a spare, not a yes or no. Running out of gas mid-service on a Friday is entirely preventable and entirely predictable from two numbers written down daily. Same for keg positions — noting the next keg is in place is a thirty-second check that saves a cellar trip during the rush.",
      "Line cleaning intervals and chemicals are specified by your dispense equipment supplier and your brewery, and they vary between systems. Seven days is the most commonly specified interval, but follow the guidance for your own setup and record what you actually used and at what dilution.",
    ],
    sheet: {
      kind: "log",
      orientation: "landscape",
      headerFields: ["Venue / site", "Month", "Cellar manager", "Line clean interval per supplier"],
      columns: [
        { name: "Date", width: 1 },
        { name: "Cellar temp", hint: "°C, against your target", width: 1 },
        { name: "Gas level / spare connected", hint: "Y / N", width: 2 },
        { name: "Next kegs in position", hint: "Y / N", width: 1 },
        { name: "Lines cleaned today", hint: "Which lines, or 'none'", width: 3 },
        { name: "Chemical and dilution", width: 3 },
        { name: "Rinsed and tested", hint: "Y / N", width: 1 },
        { name: "First pint to waste", hint: "Y / N", width: 1 },
        { name: "Initials", width: 1 },
      ],
      extraColumns: [
        { name: "Next clean due", hint: "Date", width: 2 },
        { name: "Cask ullage / waste recorded", width: 2 },
        { name: "Issues found", width: 3 },
      ],
      rowCount: 20,
      footerNotes: [
        "Record a cellar temperature every day, including days you clean nothing.",
        "Follow the line cleaning interval, chemical and dilution specified by your dispense supplier and brewery for your own system.",
        "Rinse until the water runs clear, test the pour, and put the first pint to waste. Record all three.",
      ],
    },
    howToUse: [
      "Write your cellar temperature target and your supplier's line cleaning interval in the header before printing.",
      "Take the cellar temperature at the same time each day and record it, in range or not.",
      "Check the gas level and that a spare cylinder is connected and in date, and note the next kegs are in position.",
      "On a cleaning day, record which lines were cleaned, the chemical and dilution, and initial it.",
      "Rinse until clear, test the pour, put the first pint to waste and tick each step.",
      "Write the next-clean-due date in the spreadsheet column so it is booked rather than remembered.",
    ],
    whatsIncluded: [
      "Printable PDF, landscape A4, 20 dated rows per sheet",
      "Excel (.xlsx) version with next-clean-due, ullage and issues columns",
      "CSV version for import",
      "Daily cellar temperature and gas check columns",
      "Line cleaning record with chemical, dilution and rinse confirmation",
      "Initials on every row and a cellar manager sign-off field",
    ],
    faqs: [
      {
        q: "How often should beer lines be cleaned?",
        a: "Every seven days is the interval most breweries and dispense suppliers specify, though some systems allow longer. Use the interval given for your own equipment and record every clean with a date, the chemical used and initials.",
      },
      {
        q: "What temperature should a beer cellar be?",
        a: "Around 11–13°C is the range commonly recommended for cask ale cellars, with keg products dispensed cooler through the python. Confirm the target for your own products and equipment, write it on the sheet, and record a reading daily.",
      },
      {
        q: "Why does line cleaning need to be recorded?",
        a: "Because it is the first thing asked about when there is a beer quality complaint, and because a rota without a record is guesswork. A dated log with initials also shows a brewery or auditor that the routine is real.",
      },
      {
        q: "What chemical should be used for cleaning beer lines?",
        a: "Use the line cleaning product your dispense equipment supplier or brewery specifies, at the dilution on the label, and rinse until the water runs clear. Record both the product and the dilution on the log.",
      },
    ],
    related: ["bar-opening-closing-checklist", "spirit-stocktake-sheet", "deep-clean-schedule"],
    keywords: [
      "free beer line cleaning log template",
      "cellar check sheet template pdf",
      "line cleaning record excel free",
      "pub cellar temperature log template",
    ],
  },
  {
    slug: "spirit-stocktake-sheet",
    category: "bar",
    name: "Spirit stocktake sheet",
    h1: "Free spirit stocktake sheet template",
    title: "Free Spirit Stocktake Sheet Template | Rotahr",
    metaDescription:
      "Free spirit stocktake sheet template in PDF and Excel. Count full and part bottles in tenths, value the stock, and compare expected against actual usage.",
    answer:
      "This free spirit stocktake sheet template — printable PDF or editable Excel — counts full and part bottles separately, records part bottles in tenths, and gives you a value and a variance against expected usage.",
    body: [
      "Spirits are where a bar loses money quietly. A count that only records full bottles is useless because most of the value on a busy back bar is sitting in part bottles, and \"about half\" recorded by three different people means three different figures. Count part bottles in tenths, always by eye against the label, and be consistent — consistency matters more than precision, because you are comparing counts to each other.",
      "Count the same route every time: back bar left to right, then the shelf, then the store. Bottle by bottle, with the sheet in the same order as the shelves. The most common stocktake error in a bar is not miscounting a bottle, it is counting the same bottle twice or missing a row.",
      "The variance column is the point of the exercise. Expected usage comes from your till report — measures sold times measure size — and the difference between that and what actually left the bottles is your loss. Before assuming theft, check the boring explanations: over-pouring on free-pour, unlogged wastage and breakages, staff drinks, comps, unrecorded transfers between bars and cocktail specs that use more than the recipe says.",
      "Do it at the same point in the week, after close, with the bar locked and no service running. A stocktake taken while someone is still serving is a stocktake you cannot use.",
    ],
    sheet: {
      kind: "log",
      orientation: "landscape",
      headerFields: ["Venue / site", "Count date and time", "Counted by", "Witnessed by"],
      columns: [
        { name: "Location", hint: "Back bar / shelf / store", width: 2 },
        { name: "Product", width: 4 },
        { name: "Bottle size", hint: "e.g. 70cl / 1L", width: 1 },
        { name: "Full bottles", width: 1 },
        { name: "Part bottles", hint: "In tenths, e.g. 0.4", width: 1 },
        { name: "Total units", width: 1 },
        { name: "Cost per bottle", width: 2 },
        { name: "Value", width: 2 },
      ],
      extraColumns: [
        { name: "Measure size", hint: "e.g. 25ml / 35ml / 50ml", width: 1 },
        { name: "Measures sold (till)", width: 2 },
        { name: "Expected usage", hint: "Measures sold x measure size", width: 2 },
        { name: "Actual usage", hint: "Opening + purchases − closing", width: 2 },
        { name: "Variance", width: 1 },
      ],
      rowCount: 20,
      footerNotes: [
        "Count part bottles in tenths and use the same method every time — consistency matters more than precision.",
        "Count after close with the bar locked, in the same physical order as the shelves.",
        "Before treating a variance as theft, check over-pouring, unlogged wastage, staff drinks, comps, transfers and cocktail specs.",
      ],
    },
    howToUse: [
      "List products in the physical order of your back bar, shelf and store, with bottle sizes filled in.",
      "Count after close with the bar locked and no service running, ideally with a second person witnessing.",
      "Record full bottles and part bottles separately, judging part bottles in tenths against the label.",
      "Enter cost per bottle from your latest invoices to get a value for stock on hand.",
      "Pull measures sold from your till report and enter them in the spreadsheet to get expected usage.",
      "Compare expected against actual usage, investigate the largest variances first, and act on the cause rather than the number.",
    ],
    whatsIncluded: [
      "Printable PDF, landscape A4, 20 product rows per sheet",
      "Excel (.xlsx) version with measure size, measures sold, expected usage and variance columns",
      "CSV version for import",
      "Separate full bottle and part bottle columns, part bottles in tenths",
      "Cost and value columns for stock on hand",
      "Counted-by and witnessed-by fields",
    ],
    faqs: [
      {
        q: "How do you count part bottles in a spirit stocktake?",
        a: "By eye in tenths against the label — 0.3, 0.4, 0.7 — using the same judgement every count. Scales give a more precise figure if you have them, but the value of the exercise comes from comparing counts consistently, not from absolute precision.",
      },
      {
        q: "How often should a bar do a spirit stocktake?",
        a: "Weekly for a busy bar, monthly at minimum. Always at the same point in the week, after close, before any delivery, with the bar locked.",
      },
      {
        q: "What is an acceptable variance on spirits?",
        a: "Most operators work to a low single-digit percentage and investigate anything beyond it. What matters more than the target is the trend — a variance that grows week on week on one product tells you where to look.",
      },
      {
        q: "What causes spirit stock variance other than theft?",
        a: "Free-pouring instead of measuring, unlogged breakages and wastage, staff drinks and comps, transfers between bars that were never recorded, and cocktail specs that use more spirit than the recipe on file. Check all of those before starting an investigation.",
      },
    ],
    related: ["stock-count-sheet", "cellar-check-line-cleaning-log", "daily-takings-sheet"],
    keywords: [
      "free spirit stocktake sheet template",
      "bar stocktake template excel",
      "liquor inventory sheet pdf free",
      "spirit variance calculation template",
    ],
  },
];
