import type { FreeTemplate } from "../types";

export const haccpTemplates: FreeTemplate[] = [
  {
    slug: "fridge-freezer-temperature-log",
    category: "haccp",
    name: "Fridge & freezer temperature log",
    h1: "Free fridge and freezer temperature log template",
    title: "Free Fridge Temperature Log Template | Rotahr",
    metaDescription:
      "Download a free fridge and freezer temperature log template as a printable PDF or editable Excel sheet. Two checks a day, named units, corrective action column included.",
    answer:
      "This is a free fridge and freezer temperature log template you can download as a printable PDF or an editable Excel sheet — one page per week, with a row for every named unit and space for a morning and evening reading.",
    body: [
      "Most temperature logs fail an inspection for the same two reasons: the units aren't named, and there's nowhere to record what you did when a reading was out of range. A sheet that says \"Fridge 1 — 4°C\" tells an inspector nothing if you have five fridges and nobody agrees which is which. This template makes you write the unit name once at the top of the week and then read down the same row every day.",
      "The layout assumes two checks a day, because that is what most food safety management systems ask for: one at the start of service and one at the end. If your own system asks for three, the Excel version has a spare reading column you can label.",
      "The commonly used targets printed on the sheet are 0–5°C for chilled units and −18°C or colder for frozen. Those are the figures used across most of Europe, the UK, Ireland and Australia. The US FDA Food Code works to 41°F (5°C) for cold holding, so the same sheet works in Fahrenheit if you relabel the units column. Check your own local requirement before you rely on the printed figure — the template is a recording tool, not a compliance ruling.",
      "The corrective action column is the one that matters. If a fridge reads 8°C, an inspector is not looking for a perfect record — they are looking for evidence you noticed and did something. Write what you moved, what you binned, who you called, and initial it.",
    ],
    sheet: {
      kind: "log",
      orientation: "landscape",
      headerFields: [
        "Venue / site",
        "Week commencing",
        "Manager on duty",
      ],
      columns: [
        { name: "Unit name", hint: "e.g. Walk-in chill, Prep fridge 2", width: 3 },
        { name: "Type", hint: "Chill / Freezer", width: 1 },
        { name: "Target", hint: "0–5°C / −18°C or below", width: 2 },
        { name: "AM temp", hint: "°C", width: 1 },
        { name: "AM initials", width: 1 },
        { name: "PM temp", hint: "°C", width: 1 },
        { name: "PM initials", width: 1 },
        { name: "In range?", hint: "Y / N", width: 1 },
        { name: "Corrective action taken", hint: "What you did, and who you told", width: 5 },
      ],
      extraColumns: [
        { name: "Extra check temp", hint: "°C — label this column if you check 3x daily", width: 1 },
        { name: "Extra check initials", width: 1 },
      ],
      rowCount: 14,
      footerNotes: [
        "Record a reading even when the unit is empty — a gap in the log looks like a missed check.",
        "Any reading outside target needs an entry in the corrective action column, not just a circle around the number.",
        "Keep completed sheets for the retention period your own food safety management system specifies.",
      ],
    },
    howToUse: [
      "Print one sheet per week and put it on a clipboard beside the units, not in the office.",
      "Write your unit names into the first column once, using the names actually painted or labelled on the equipment.",
      "Fill the target column for each unit — chilled or frozen — so nobody has to remember the threshold.",
      "Take the AM reading before service starts and the PM reading at close, initialling each one as you go.",
      "If a reading is out of range, mark N, then write in the corrective action column what you moved, what you discarded and who you informed.",
      "At the end of the week, have the manager on duty sign the sheet and file it with your food safety records.",
    ],
    whatsIncluded: [
      "Printable PDF, landscape A4, 14 unit rows per week",
      "Editable Excel (.xlsx) version with the same layout and a spare reading column",
      "CSV version if you want to import it into your own system",
      "Header block for venue, week commencing and manager on duty",
      "Target column with the commonly used chilled and frozen figures pre-printed",
      "Corrective action column wide enough to actually write in",
    ],
    faqs: [
      {
        q: "How often should fridge temperatures be checked?",
        a: "Twice a day is the working standard in most food safety management systems — once at the start of service and once at the end. Some systems ask for a check at every shift change instead. The template is laid out for two checks with a spare column in the Excel version if you need a third.",
      },
      {
        q: "What temperature should a commercial fridge be?",
        a: "0–5°C is the range used across the UK, Ireland, most of Europe and Australia. The US FDA Food Code sets cold holding at 41°F (5°C) or below. Freezers should sit at −18°C or colder. Confirm against your own local requirement before printing.",
      },
      {
        q: "What do I write if a fridge is out of range?",
        a: "Write what you actually did: moved stock to another unit, discarded specific items, called the engineer, or turned the unit down and re-checked in an hour. Then record the re-check. An inspector wants to see a decision, not a clean sheet.",
      },
      {
        q: "Do I need a digital temperature log instead of paper?",
        a: "Paper is accepted everywhere as long as it is complete, legible and retained. Digital logs mainly help with the two things paper is bad at: nobody can back-fill a week of readings the night before an inspection, and you get an alert when a check is missed rather than finding out later.",
      },
    ],
    related: [
      "cooking-cooling-temperature-log",
      "delivery-check-record",
      "haccp-corrective-action-log",
    ],
    keywords: [
      "free fridge temperature log template",
      "fridge freezer temperature record sheet",
      "haccp temperature log template excel",
      "commercial fridge temperature check sheet",
    ],
  },
  {
    slug: "cooking-cooling-temperature-log",
    category: "haccp",
    name: "Cooking & cooling temperature log",
    h1: "Free cooking and cooling temperature log template",
    title: "Free Cooking & Cooling Temp Log Template | Rotahr",
    metaDescription:
      "Free cooking and cooling temperature log template in PDF and Excel. Records core temperatures, cooling start and end times, and calculates a use-by date.",
    answer:
      "This free cooking and cooling temperature log template — printable PDF or editable Excel — records the core temperature of cooked items and tracks how fast cooked food came down through the danger zone, with a column for the use-by date you assign afterwards.",
    body: [
      "Cooking and cooling are the two steps where a kitchen most often loses control of food safety, and they are the two most awkward to record because both involve a clock as well as a thermometer. This sheet keeps them on one page so the same person doing the batch cook fills in both halves.",
      "For cooking, the widely used pass figure is a core temperature of 75°C held momentarily, with equivalent time-temperature combinations accepted in most systems (for example 70°C for two minutes). The US Food Code works in Fahrenheit with product-specific minimums. Print whichever figure your own system specifies in the target column rather than assuming the one on the sheet applies to you.",
      "For cooling, the sheet records a start time and temperature, an end time and temperature, and asks for the elapsed time. The common two-stage rule is down to 21°C within two hours and to 5°C within a further four. Writing the start time down is the whole trick — teams that only record the final temperature can never prove the food got there fast enough.",
      "The use-by column exists because a cooling record without a date on the container is useless the next morning. Fill in the date you have written on the label, so the sheet and the container agree.",
    ],
    sheet: {
      kind: "log",
      orientation: "landscape",
      headerFields: ["Venue / site", "Date", "Chef on duty"],
      columns: [
        { name: "Item / batch", hint: "Name it as the label says", width: 4 },
        { name: "Step", hint: "Cook / Cool", width: 1 },
        { name: "Start time", hint: "hh:mm", width: 1 },
        { name: "Start temp", hint: "°C", width: 1 },
        { name: "End time", hint: "hh:mm", width: 1 },
        { name: "Core / end temp", hint: "°C", width: 1 },
        { name: "Elapsed", hint: "hh:mm", width: 1 },
        { name: "Pass?", hint: "Y / N", width: 1 },
        { name: "Use-by date", hint: "As written on the label", width: 2 },
        { name: "Initials", width: 1 },
      ],
      rowCount: 16,
      footerNotes: [
        "Probe the thickest part of the item, and sanitise the probe between items.",
        "A cooling record without a start time cannot be verified — write it down before you walk away.",
        "Failed items need a corrective action entry: reheat, extend cooling in a shallower tray, or discard.",
      ],
    },
    howToUse: [
      "Print one sheet per day and keep it on the pass or beside the blast chiller.",
      "Write the batch name exactly as it appears on the container label so the two can be matched later.",
      "For a cook, record the finish time and the core temperature you probed, then mark pass or fail against your target figure.",
      "For a cool, record the time and temperature the moment the item comes off the heat — not when you remember.",
      "Take the closing reading, work out the elapsed time, and mark pass or fail against your two-stage cooling rule.",
      "Copy the use-by date from the container label into the last column and initial the row.",
    ],
    whatsIncluded: [
      "Printable PDF, landscape A4, 16 batch rows per day",
      "Editable Excel (.xlsx) with an elapsed-time formula already in place",
      "CSV version for importing elsewhere",
      "Separate cook and cool rows so one batch can be tracked through both steps",
      "Use-by date column that matches what goes on the label",
      "Footer prompts for probe hygiene and failed-batch actions",
    ],
    faqs: [
      {
        q: "What core temperature should cooked food reach?",
        a: "75°C in the thickest part is the figure used across the UK, Ireland and Australia, with equivalents such as 70°C for two minutes accepted. The US Food Code sets product-specific minimums in Fahrenheit. Print your own system's figure in the target column.",
      },
      {
        q: "How fast does cooked food need to cool?",
        a: "The widely used two-stage rule is 60°C down to 21°C within two hours, then down to 5°C within a further four hours. Portioning into shallower trays is usually what fixes a failed cool.",
      },
      {
        q: "How do I work out a use-by date for cooked food?",
        a: "Many kitchens use the day of production plus three days for chilled cooked food, but the correct figure depends on the product and your own shelf-life validation. Whatever you decide, the label and this log should say the same date.",
      },
      {
        q: "Do I have to record every batch?",
        a: "Record every batch you cook and cool for later use. Items cooked to order and served immediately are usually covered by a periodic spot check instead — check what your own food safety management system requires.",
      },
    ],
    related: [
      "reheat-hot-holding-record",
      "fridge-freezer-temperature-log",
      "haccp-corrective-action-log",
      "delivery-check-record",
    ],
    keywords: [
      "cooking temperature log template",
      "food cooling log template free",
      "core temperature record sheet kitchen",
      "haccp cooking cooling record excel",
    ],
  },
  {
    slug: "delivery-check-record",
    category: "haccp",
    name: "Delivery check record",
    h1: "Free delivery check record template for kitchens",
    title: "Free Delivery Check Record Template | Rotahr",
    metaDescription:
      "Free goods-in delivery check record template in PDF and Excel. Log supplier, temperature on arrival, packaging condition, date codes and anything rejected.",
    answer:
      "This free delivery check record template — printable PDF or editable Excel — gives you one row per delivery to record the supplier, the temperature of chilled and frozen goods on arrival, packaging and date-code condition, and exactly what you rejected and why.",
    body: [
      "Goods-in is the cheapest place to catch a food safety problem and the easiest check to skip, because deliveries arrive during prep when nobody has a spare hand. The sheet is deliberately one row per delivery rather than one row per item — a checklist you can finish in ninety seconds actually gets done.",
      "The temperature-on-arrival column is the one inspectors look for. Probe between packs rather than piercing a sealed item, and record the number you saw, not the number you expected. Chilled goods arriving above 8°C and frozen goods showing signs of thaw are the two rejections worth being strict about.",
      "The rejected column carries more weight than the accepted rows. A record showing you turned back a warm delivery is direct evidence your system works, and it is also the record you will want when the supplier disputes a credit note.",
      "If you already scan delivery notes into your bookkeeping, keep this sheet anyway — an invoice proves what you were charged, not what condition it arrived in.",
    ],
    sheet: {
      kind: "log",
      orientation: "landscape",
      headerFields: ["Venue / site", "Week commencing", "Manager on duty"],
      columns: [
        { name: "Date", hint: "dd/mm", width: 1 },
        { name: "Time", hint: "hh:mm", width: 1 },
        { name: "Supplier", width: 3 },
        { name: "Goods type", hint: "Chilled / Frozen / Ambient / Fresh produce", width: 2 },
        { name: "Temp on arrival", hint: "°C — chilled & frozen only", width: 1 },
        { name: "Packaging OK?", hint: "Y / N", width: 1 },
        { name: "Date codes OK?", hint: "Y / N", width: 1 },
        { name: "Vehicle clean?", hint: "Y / N", width: 1 },
        { name: "Accepted / rejected", width: 2 },
        { name: "Reason & action if rejected", width: 5 },
        { name: "Initials", width: 1 },
      ],
      rowCount: 15,
      footerNotes: [
        "Probe between packs — never pierce a sealed pack you intend to accept.",
        "Chilled goods above 8°C on arrival, or frozen goods showing thaw or refreeze, should be refused.",
        "Put chilled and frozen goods away before you complete the paperwork, then fill the row in.",
      ],
    },
    howToUse: [
      "Print one sheet per week and keep it at the back door with a probe and sanitising wipes.",
      "Start a row the moment a delivery lands: date, time and supplier.",
      "Probe chilled and frozen items between packs and write the reading in the temperature column.",
      "Check packaging integrity, date codes and the state of the delivery vehicle, and mark each Y or N.",
      "Put the goods away before finishing the paperwork so nothing sits out warming up.",
      "If you reject anything, name the item and the reason, and note whether it went back on the van or was credited.",
    ],
    whatsIncluded: [
      "Printable PDF, landscape A4, 15 delivery rows per week",
      "Editable Excel (.xlsx) and CSV versions",
      "Temperature, packaging, date code and vehicle condition columns",
      "Wide reject reason column for supplier disputes and credit notes",
      "Footer prompts on probe technique and refusal thresholds",
    ],
    faqs: [
      {
        q: "What temperature should a chilled delivery be on arrival?",
        a: "Chilled goods should arrive at 8°C or below, and frozen goods at −18°C with no sign of thaw or refreeze. Some suppliers work to tighter contract limits — use theirs if they are stricter.",
      },
      {
        q: "Do I need to check every delivery?",
        a: "Yes for chilled, frozen and fresh produce. Ambient dry goods usually need a packaging and date-code check rather than a temperature reading, which is why the goods type column exists.",
      },
      {
        q: "What should I do if a delivery fails the check?",
        a: "Refuse the affected items at the door, record the reason on this sheet, and get the driver to acknowledge it. Then follow up with the supplier for a credit. Accepting and binning it later costs you the credit and the evidence.",
      },
      {
        q: "Can I use the delivery note instead of a separate record?",
        a: "A delivery note records what was sent and what you were charged. It does not record the temperature on arrival or the condition of the packaging, which is the part a food safety inspection is interested in.",
      },
    ],
    related: [
      "fridge-freezer-temperature-log",
      "haccp-corrective-action-log",
      "stock-count-sheet",
    ],
    keywords: [
      "delivery check record template free",
      "goods in temperature check sheet",
      "food delivery inspection log template",
      "haccp delivery record excel",
    ],
  },
  {
    slug: "haccp-corrective-action-log",
    category: "haccp",
    name: "Corrective action log",
    h1: "Free HACCP corrective action log template",
    title: "Free HACCP Corrective Action Log | Rotahr",
    metaDescription:
      "Free HACCP corrective action log template in PDF and Excel. Record what went wrong, the immediate action, the root cause and who signed it off.",
    answer:
      "This free HACCP corrective action log template — printable PDF or editable Excel — records every failed check in one place: what went wrong, what you did immediately, what you changed so it does not recur, and who signed it off.",
    body: [
      "A corrective action log is the record that turns a pile of tick sheets into a working food safety management system. Anyone can produce clean temperature logs. What an inspector is actually assessing is whether your team notices a failure and does something predictable about it.",
      "The sheet is structured around four questions, because \"sorted it\" is not a corrective action. What was the failure and where was it found? What did you do to the food, right then? What is the underlying cause — a door seal, a delivery window, a training gap? And what changed as a result?",
      "Keep it to genuine deviations: a temperature outside target, a missed check, a failed delivery, a pest sighting, an equipment breakdown, a complaint with a food safety angle. If everything goes in, nothing gets read.",
      "The sign-off column is not bureaucracy. It is the difference between a note somebody left and a decision a manager took, and it is the first thing checked when the same fault appears three times in a quarter.",
    ],
    sheet: {
      kind: "log",
      orientation: "landscape",
      headerFields: ["Venue / site", "Period covered", "Responsible manager"],
      columns: [
        { name: "Date & time", hint: "dd/mm hh:mm", width: 2 },
        { name: "Where found", hint: "Check type or area", width: 2 },
        { name: "What went wrong", hint: "The deviation, with the reading if there was one", width: 5 },
        { name: "Immediate action", hint: "What happened to the food", width: 5 },
        { name: "Root cause", width: 4 },
        { name: "Preventive change", hint: "What is different now", width: 4 },
        { name: "Closed?", hint: "Y / N", width: 1 },
        { name: "Signed off by", width: 2 },
      ],
      rowCount: 10,
      footerNotes: [
        "Log the deviation on the day it happens — a log written up weekly is worth very little.",
        "Immediate action should say what happened to the food: moved, reheated, discarded, released.",
        "Review open entries at your management meeting and close them off in writing.",
      ],
    },
    howToUse: [
      "Keep one log per site rather than one per check type, so repeat faults are visible in one place.",
      "Open an entry as soon as a check fails, with the date, time and where it was found.",
      "Describe the deviation in numbers where you have them — \"walk-in chill 9.4°C at 07:20\" beats \"fridge warm\".",
      "Record the immediate action taken on the food itself before anything else.",
      "Write the root cause once you know it, and the preventive change that follows from it.",
      "Have a manager sign off and mark the entry closed. Review anything still open at your next management meeting.",
    ],
    whatsIncluded: [
      "Printable PDF, landscape A4, 10 wide entry rows",
      "Editable Excel (.xlsx) and CSV versions",
      "Separate immediate action, root cause and preventive change columns",
      "Closed / signed-off columns for management review",
      "Footer prompts to keep entries same-day and food-focused",
    ],
    faqs: [
      {
        q: "What counts as a corrective action?",
        a: "Two things: what you did to the affected food, and what you changed so the same failure does not repeat. A reading you circled and left alone is not a corrective action.",
      },
      {
        q: "How long should I keep corrective action records?",
        a: "Keep them for at least as long as your other food safety records — commonly one to two years, depending on your jurisdiction and the shelf life of what you produce. Check your own local requirement.",
      },
      {
        q: "Should minor issues go in the log?",
        a: "Log anything that breached a control: a temperature out of range, a missed check, a rejected delivery, a pest sighting, a breakdown. Routine maintenance and general tidiness belong on a cleaning or maintenance sheet instead.",
      },
      {
        q: "Who should sign off a corrective action?",
        a: "Whoever is accountable for that control — usually the head chef or duty manager. The person who found the problem can record it, but sign-off should come from someone able to authorise the preventive change.",
      },
    ],
    related: [
      "fridge-freezer-temperature-log",
      "cooking-cooling-temperature-log",
      "accident-incident-report-form",
    ],
    keywords: [
      "haccp corrective action log template",
      "food safety corrective action record free",
      "corrective action form kitchen",
      "haccp deviation log excel",
    ],
  },
  {
    slug: "reheat-hot-holding-record",
    category: "haccp",
    name: "Reheat & hot holding record",
    h1: "Free reheat and hot holding temperature record template",
    title: "Free Reheat & Hot Holding Log Template | Rotahr",
    metaDescription:
      "Free reheat and hot holding temperature record template in PDF and Excel. Log the reheat core temperature, the time food went into hot hold, and every check after that.",
    answer:
      "This free reheat and hot holding record template — printable PDF or editable Excel — gives you one row per batch to log the core temperature it reached on reheating, the time it went into the hot hold unit, a temperature check every hour or two after that, and the time it came off or was discarded.",
    body: [
      "Reheating and hot holding are usually recorded badly or not at all, because the food is already cooked and the pressure is off. That is exactly backwards: reheated food has been through the danger zone twice, and food sitting in a bain-marie at 55°C for three hours is a far more common cause of illness than an undercooked chicken. This sheet keeps both steps on one row so the batch that was reheated is the same batch you can see being held.",
      "For the reheat, the widely used pass figure is a core temperature of 70°C held for two minutes, or 75°C reached momentarily. Scotland works to 82°C. The US Food Code asks for 165°F (74°C) for fifteen seconds on previously cooked and cooled food. Print whichever figure your own food safety management system specifies in the target column instead of assuming the one on the sheet applies to you.",
      "For the hold, 63°C or above is the figure used in the UK and Ireland, 60°C in Australia, and 135°F (57°C) in the US. The point of the repeat check columns is not the first reading — a bain-marie is always hot when the food goes in. It is the reading two hours later, when the unit is half empty and the water has dropped, that either proves the hold worked or tells you to discard.",
      "The two-hour allowance in the UK lets food be held below temperature once, for up to two hours, after which it must be used, chilled or thrown out. That is why the sheet asks for the time the batch came off as well as the time it went on. Without both times, an elapsed period out of temperature can never be shown, and reheating a second time is not an option under any system.",
    ],
    sheet: {
      kind: "log",
      orientation: "landscape",
      headerFields: ["Venue / site", "Date", "Chef on duty"],
      columns: [
        { name: "Item / batch", hint: "Name it as the label says", width: 4 },
        { name: "Reheat time", hint: "hh:mm", width: 1 },
        { name: "Reheat core temp", hint: "°C", width: 1 },
        { name: "Pass?", hint: "Y / N", width: 1 },
        { name: "Into hot hold", hint: "hh:mm", width: 1 },
        { name: "Unit", hint: "Bain-marie / gantry / cabinet", width: 2 },
        { name: "Check 1", hint: "hh:mm + °C", width: 2 },
        { name: "Check 2", hint: "hh:mm + °C", width: 2 },
        { name: "Off / discarded", hint: "hh:mm — circle which", width: 1 },
        { name: "Initials", width: 1 },
      ],
      extraColumns: [
        { name: "Check 3", hint: "hh:mm + °C", width: 2 },
        { name: "Corrective action", hint: "What you did about a low reading", width: 5 },
        { name: "Reheated from", hint: "Chilled / Frozen", width: 2 },
      ],
      rowCount: 14,
      footerNotes: [
        "Reheat once only. Food that has been reheated and not used is discarded, not held for tomorrow.",
        "Probe the thickest part of the item in the tray, not the water or the tray edge, and sanitise the probe between items.",
        "A low hold reading needs an action recorded: turn the unit up and re-probe, reheat the batch through, or discard.",
      ],
    },
    howToUse: [
      "Print one sheet per day and keep it on the pass next to the hot hold unit.",
      "Write the batch name exactly as it appears on the container label so it can be matched to the cooking and cooling record.",
      "Reheat the item, probe the thickest part, and record the time and core temperature — then mark pass or fail against your own target figure.",
      "Note the time the batch went into the hot hold unit and which unit it went into.",
      "Re-probe every hour or two during service and write the time alongside each reading, not just the temperature.",
      "Record the time the batch came off, and whether it was used or discarded. Initial the row.",
    ],
    whatsIncluded: [
      "Printable PDF, landscape A4, 14 batch rows per day",
      "Editable Excel (.xlsx) with a third check column, a corrective action column and a chilled/frozen field",
      "CSV version for importing elsewhere",
      "Reheat core temperature and pass/fail columns on the same row as the hold",
      "Timed check columns so time out of temperature can be worked out afterwards",
      "Off/discarded column and footer prompts covering the reheat-once rule",
    ],
    faqs: [
      {
        q: "What temperature should food be reheated to?",
        a: "70°C held for two minutes, or 75°C in the thickest part, are the figures used across most of the UK, Ireland and Australia. Scotland works to 82°C and the US Food Code asks for 165°F (74°C) for fifteen seconds. Print your own system's figure in the target column.",
      },
      {
        q: "What temperature should hot food be held at?",
        a: "63°C or above in the UK and Ireland, 60°C in Australia, and 135°F (57°C) under the US Food Code. Check which applies to you before relying on the figure printed on the sheet.",
      },
      {
        q: "How long can hot food be held below temperature?",
        a: "UK guidance allows food to be held below 63°C once, for up to two hours, after which it must be served, chilled or discarded. Other systems differ, so record the times either way — the elapsed period is what anyone reviewing the sheet will ask about.",
      },
      {
        q: "How often should I check hot holding temperatures?",
        a: "Most kitchens probe at the start of service and then every one to two hours. The sheet prints two check columns and the spreadsheet has a third, which covers a long service without turning the record into a chore.",
      },
      {
        q: "Can food be reheated twice?",
        a: "No. Reheat once and then use it or discard it. That is why the sheet asks you to record the time a batch came off the hot hold and what happened to it.",
      },
    ],
    related: [
      "cooking-cooling-temperature-log",
      "fridge-freezer-temperature-log",
      "haccp-corrective-action-log",
    ],
    keywords: [
      "reheat temperature log template free",
      "hot holding temperature record sheet",
      "bain marie temperature log template",
      "haccp reheating record excel",
    ],
  },
];
