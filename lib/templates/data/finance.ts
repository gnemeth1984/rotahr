import type { FreeTemplate } from "../types";

export const financeTemplates: FreeTemplate[] = [
  {
    slug: "daily-takings-sheet",
    category: "finance",
    name: "Daily takings sheet",
    h1: "Free daily takings sheet template",
    title: "Free Daily Takings Sheet Template | Rotahr",
    metaDescription:
      "Free daily takings sheet template in PDF and Excel. Reconciles cash, card and other payments against the till report, with variance, float and banking fields.",
    answer:
      "This free daily takings sheet template — printable PDF or editable Excel — reconciles counted cash and card settlements against the till report for one trading day, showing the variance, the float carried forward and what was banked.",
    body: [
      "A takings sheet exists to answer one question: does what we counted match what the till says we sold? Everything on it works toward that single line. If you never write the variance down, you never find out that Tuesdays are consistently short, and by the time it shows up in the accounts the trail is months cold.",
      "Count cash before looking at the till report, and have a second person verify the count. Counting after you know the target number is how people unconsciously reconcile to it. Two signatures on the count is the simplest internal control a small venue has, and it protects the person counting as much as the business.",
      "Break payments out by method: cash, each card terminal separately, vouchers, account sales, deliveries and online orders, and any deposit taken for a future booking. Deposits are the classic distortion — money in the drawer today for a booking next month is not today's takings, and treating it as such makes the sheet disagree with the accounts.",
      "Record comps, staff meals, discounts and refunds on the same sheet. They are not takings, but they explain the gap between what walked out of the kitchen and what was paid for, and a refund with no reason written beside it is the entry an accountant or an auditor will always come back to.",
    ],
    sheet: {
      kind: "form",
      orientation: "portrait",
      headerFields: ["Venue / site", "Trading date", "Duty manager", "Counted with (second person)"],
      sections: [
        {
          title: "Cash counted",
          rows: [
            "Notes counted (total)",
            "Coin counted (total)",
            "Total cash in drawer",
            "Less opening float",
            "Net cash takings",
            "Cash tips held separately (not takings)",
          ],
        },
        {
          title: "Card and other payments",
          rows: [
            "Card terminal 1 — settlement total",
            "Card terminal 2 — settlement total",
            "Mobile or contactless device total",
            "Online and delivery platform sales",
            "Account or invoiced sales",
            "Vouchers and gift cards redeemed",
            "Deposits taken for future bookings (excluded from today's sales)",
          ],
        },
        {
          title: "Till report",
          rows: [
            "Gross sales per till report",
            "Refunds and voids (with reason)",
            "Discounts applied",
            "Comps and staff meals",
            "Net sales per till report",
            "Covers / transactions",
            "Average spend per cover",
          ],
        },
        {
          title: "Reconciliation",
          rows: [
            "Total payments counted (cash + card + other)",
            "Net sales per till report",
            "Variance (counted − till)",
            "Explanation for any variance",
          ],
        },
        {
          title: "Banking and close",
          rows: [
            "Cash banked or bagged for collection",
            "Bag or reference number",
            "Float set aside for tomorrow",
            "Cash left in safe",
            "Duty manager signature",
            "Second person signature",
            "Reviewed by owner or accounts (date)",
          ],
        },
      ],
      footerNotes: [
        "Count the cash before you look at the till report, with two people signing the count.",
        "Deposits for future bookings are money held, not sales taken today. Keep them on their own line.",
        "Write an explanation beside every variance the same day. A variance found weeks later is an investigation, not a query.",
      ],
    },
    howToUse: [
      "Count the drawer at close with a second person present, before looking at any till figure.",
      "Deduct the opening float to get net cash takings, and keep cash tips separate from takings.",
      "Settle each card terminal and enter each settlement total on its own line.",
      "Put deposits for future bookings on their own line so they are not counted as today's sales.",
      "Enter the till report figures, then compare total payments against net sales and write the variance down.",
      "Bag the banking, set tomorrow's float, both sign the sheet, and pass it to the owner or accounts.",
    ],
    whatsIncluded: [
      "Printable PDF, portrait A4, one trading day per sheet",
      "Excel (.xlsx) version you can keep as a running daily takings log",
      "CSV version for import",
      "Separate lines per card terminal, platform, voucher and account sales",
      "Deposits line so future bookings are not counted as today's takings",
      "Variance line with an explanation field and dual signatures",
    ],
    faqs: [
      {
        q: "What should be on a daily takings sheet?",
        a: "Counted cash less the float, each card terminal settlement, other payment methods, the till report's net sales, and the variance between what was counted and what the till says — plus banking, tomorrow's float and two signatures.",
      },
      {
        q: "Why does my cash never balance exactly?",
        a: "Small variances usually come from change errors, tips going into the wrong pot, refunds processed as cash, deposits taken at the bar, or a card transaction keyed as cash. Recording the variance daily is how you tell random noise from a pattern.",
      },
      {
        q: "Should tips be included in daily takings?",
        a: "Keep them separate. Service charge processed through the till behaves differently from cash tips left on a table, and mixing them into takings makes both the reconciliation and the tips distribution harder to defend later.",
      },
      {
        q: "Who should sign off the daily takings sheet?",
        a: "The duty manager and a second person who witnessed the count, with the owner or accounts reviewing it afterwards. Single-signature cash handling is the control weakness most often found after a loss.",
      },
    ],
    related: ["tips-tronc-distribution-sheet", "wastage-log", "bar-opening-closing-checklist"],
    keywords: [
      "free daily takings sheet template",
      "cash reconciliation template restaurant",
      "daily sales reconciliation sheet pdf",
      "till cash up sheet excel free",
    ],
  },
  {
    slug: "tips-tronc-distribution-sheet",
    category: "finance",
    name: "Tips & tronc distribution sheet",
    h1: "Free tips and tronc distribution sheet template",
    title: "Free Tips & Tronc Distribution Sheet | Rotahr",
    metaDescription:
      "Free tips and tronc distribution sheet template in PDF and Excel. Splits pooled tips by hours worked or points, showing the calculation every staff member can check.",
    answer:
      "This free tips and tronc distribution sheet template — printable PDF or editable Excel — records the tips collected for a period and splits them by hours worked or a points system, with the whole calculation visible so anyone can check their own share.",
    body: [
      "Tips cause more resentment than pay does, and almost always for the same reason: nobody can see the sum. A distribution sheet that shows the pool, the total hours or points, the rate per hour or point and each person's share removes the argument entirely, because anyone can check their own line in ten seconds.",
      "Decide and write down which method you use before the period starts. Hours worked is the simplest and hardest to dispute. A points system lets you weight roles differently — a section server on more points than a runner — but only works if the points are published in advance. Changing the method after the tips are counted is the single fastest way to lose a team's trust.",
      "Keep card service charge and cash tips as separate lines. They often arrive differently, are recorded differently and may be treated differently for tax and payroll, and pooling them into one figure makes any later question impossible to answer. Record what came in through each route, then pool for distribution if that is your policy.",
      "The rules on tips are genuinely different by country and change over time: who may participate, whether an employer can retain any part, whether a service charge must be passed on, how it is taxed, and what records you must keep. This sheet is a transparent calculation tool, not tax or legal advice — set your policy against your own local law and take advice if you are unsure.",
    ],
    sheet: {
      kind: "log",
      orientation: "landscape",
      headerFields: [
        "Venue / site",
        "Period covered",
        "Distribution method (hours or points)",
        "Tronc administrator",
      ],
      columns: [
        { name: "Staff member", width: 3 },
        { name: "Role", width: 2 },
        { name: "Hours worked in period", width: 2 },
        { name: "Points weighting", hint: "If using a points system", width: 1 },
        { name: "Points total", hint: "Hours x weighting", width: 1 },
        { name: "Share of pool", hint: "%", width: 1 },
        { name: "Amount due", width: 2 },
        { name: "Paid via", hint: "Payroll / cash", width: 2 },
        { name: "Signature", width: 2 },
      ],
      extraColumns: [
        { name: "Card service charge in pool", width: 2 },
        { name: "Cash tips in pool", width: 2 },
        { name: "Deductions per written policy", width: 2 },
        { name: "Notes", width: 3 },
      ],
      rowCount: 16,
      footerNotes: [
        "Write the pool total, total hours or points, and the rate per hour or point at the bottom of the sheet so the calculation is checkable.",
        "Keep card service charge and cash tips on separate lines before pooling.",
        "Rules on tips, service charge, deductions and tax differ by country and change. Set your policy against your own local law — this sheet is a calculation tool, not advice.",
      ],
    },
    howToUse: [
      "Agree and publish your distribution method and any role weightings before the period starts.",
      "Record card service charge and cash tips separately as they come in, then total the pool.",
      "Enter each person's hours worked for the period from your rota or clock-in records.",
      "Apply the points weighting if you use one, and total the points across the team.",
      "Divide the pool by total hours or points to get the rate, and calculate each person's amount due.",
      "Publish the sheet with the totals shown, pay through the agreed route, and have each person sign for what they received.",
    ],
    whatsIncluded: [
      "Printable PDF, landscape A4, 16 staff rows per period",
      "Excel (.xlsx) version with separate card service charge and cash tip pool columns",
      "CSV version for import",
      "Hours and points columns so it works for either distribution method",
      "Share percentage and amount due columns showing the full calculation",
      "Signature column and tronc administrator field",
    ],
    faqs: [
      {
        q: "What is a tronc?",
        a: "A tronc is an arrangement for pooling and sharing tips and service charge among staff, usually run by a nominated administrator rather than by the business owner. How a tronc must be operated and taxed depends on your country, so check your local rules before setting one up.",
      },
      {
        q: "Should tips be split by hours or by role?",
        a: "Hours worked is the simplest and hardest to argue with. Points let you weight roles — front of house against kitchen, senior against junior — but only work if the weightings are published before the period, not decided after the money is counted.",
      },
      {
        q: "Can an employer keep part of the tips?",
        a: "That depends entirely on your jurisdiction, and the rules have tightened in several countries in recent years. Check your own local law and, if any deduction is permitted and applied, state it in a written policy and show it on the sheet.",
      },
      {
        q: "Do kitchen staff get a share of tips?",
        a: "Many venues include the kitchen, some through a lower weighting. Whatever you decide, publish it in a written policy that says who participates — the disputes come from an unwritten rule people discover on payday.",
      },
    ],
    related: ["daily-takings-sheet", "weekly-staff-rota", "staff-training-record"],
    keywords: [
      "free tips distribution sheet template",
      "tronc calculation template excel",
      "tip pooling spreadsheet free",
      "service charge distribution template pdf",
    ],
  },
];
