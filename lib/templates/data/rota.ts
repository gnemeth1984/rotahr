import type { FreeTemplate } from "../types";

export const rotaTemplates: FreeTemplate[] = [
  {
    slug: "weekly-staff-rota",
    category: "rota",
    name: "Weekly staff rota",
    h1: "Free weekly staff rota template",
    title: "Free Weekly Staff Rota Template | Rotahr",
    metaDescription:
      "Download a free weekly staff rota template as a printable PDF or an Excel sheet that totals hours per person automatically. One page, Monday to Sunday, 16 staff rows.",
    answer:
      "This is a free weekly staff rota template you can download as a printable PDF for the staff room wall or as an Excel sheet that adds up each person's hours for you — Monday to Sunday, one line per team member.",
    body: [
      "A rota only works if a person can find their own name in under five seconds. That means one row per person, days across the top, and nothing else competing for space. This template deliberately has no colour coding, no section splits and no notes column in the middle of the grid — those are the three things that turn a readable rota into a puzzle by Thursday.",
      "Write shifts as start and finish times, not as \"early\" or \"late\". Every kitchen has an argument at some point about what \"late\" meant, and the argument always happens on the busiest night. Times remove it. If a shift has a fixed break, write it into the cell as well: 17:00–23:00 (30).",
      "The Excel version totals contracted hours per person down the right-hand column, which is the number that matters when you are checking someone is not about to tip into overtime or breach a rest-period rule. It also totals hours per day at the bottom, so you can see at a glance whether you have front-loaded Saturday and left Sunday thin.",
      "Publish it in the same place at the same time every week. The single biggest cause of no-shows in hospitality is not people forgetting — it is a rota that changed after they looked at it. If you do change a published shift, tell the person directly rather than editing the sheet and hoping they check again.",
    ],
    sheet: {
      kind: "log",
      orientation: "landscape",
      headerFields: ["Venue / site", "Week commencing", "Published by", "Date published"],
      columns: [
        { name: "Team member", width: 3 },
        { name: "Role", hint: "Kitchen / bar / FOH", width: 2 },
        { name: "Mon", hint: "Start–finish", width: 2 },
        { name: "Tue", width: 2 },
        { name: "Wed", width: 2 },
        { name: "Thu", width: 2 },
        { name: "Fri", width: 2 },
        { name: "Sat", width: 2 },
        { name: "Sun", width: 2 },
        { name: "Total hrs", width: 1 },
      ],
      extraColumns: [
        { name: "Contracted hrs", hint: "For comparing against the total", width: 1 },
        { name: "Notes", hint: "Training, holiday, unavailability", width: 4 },
      ],
      rowCount: 16,
      footerNotes: [
        "Write shifts as start and finish times, with any fixed break in brackets: 17:00–23:00 (30).",
        "Mark holiday, training and unavailability on the sheet too — a blank cell is ambiguous, and someone will assume it means they are off.",
        "Once published, tell anyone whose shift changes directly. Do not rely on them re-reading the sheet.",
      ],
    },
    howToUse: [
      "Print or open one sheet per week and fill in the venue, week commencing date and who published it.",
      "List your team down the left, grouped by section so the kitchen block and the bar block stay together.",
      "Fill each day cell with a start and finish time, putting any fixed break in brackets.",
      "Write H for holiday, T for training and U for unavailable rather than leaving cells blank.",
      "Check the total hours column against each person's contracted hours before you publish.",
      "Publish at the same time every week, in the same place, and date-stamp the version so everyone knows which sheet is current.",
    ],
    whatsIncluded: [
      "Printable PDF, landscape A4, Monday to Sunday grid with 16 staff rows",
      "Excel (.xlsx) version with per-person and per-day hour totals",
      "CSV version for importing into another system",
      "Role column so you can see section cover at a glance",
      "Contracted hours and notes columns in the spreadsheet version",
      "Published-by and date-published fields so there is only ever one current version",
    ],
    faqs: [
      {
        q: "How far in advance should a staff rota be published?",
        a: "Two weeks is the standard people plan their lives around, and one week is the practical minimum. Some jurisdictions have specific advance-notice rules for scheduling, so check your local employment rules — but the operational reason for publishing early is simpler: late rotas cause no-shows.",
      },
      {
        q: "Does the Excel version calculate hours automatically?",
        a: "The spreadsheet has a total column per person and a total row per day. Enter shift times and the totals give you the weekly figure to check against contracted hours.",
      },
      {
        q: "Can I use this rota template for split shifts?",
        a: "Yes — write both blocks in the same cell, for example 11:00–15:00 / 18:00–23:00. If split shifts are the norm rather than the exception in your venue, use the Excel version so the column widens to fit.",
      },
      {
        q: "What is the difference between this and rota software?",
        a: "A spreadsheet is fine for one venue and a stable team. It stops working when you need to know who actually turned up, handle swap requests, or turn hours worked into payroll — that is where a rota tool earns its keep, because the same shift data feeds clock-in and pay without being retyped.",
      },
    ],
    related: ["shift-swap-request-form", "holiday-request-form", "new-staff-induction-checklist"],
    keywords: [
      "free weekly staff rota template",
      "staff rota template excel",
      "printable rota template pdf",
      "restaurant rota template free download",
    ],
  },
  {
    slug: "shift-swap-request-form",
    category: "rota",
    name: "Shift swap request form",
    h1: "Free shift swap request form template",
    title: "Free Shift Swap Request Form Template | Rotahr",
    metaDescription:
      "Free shift swap request form template in PDF and Excel. Records who is giving up the shift, who is covering it, and the manager approval that makes it official.",
    answer:
      "This free shift swap request form template — printable PDF or editable Excel — records both sides of a swap and the manager's approval, so a shift is never left uncovered because two people agreed something verbally.",
    body: [
      "Almost every uncovered shift in hospitality starts with a swap that was agreed in a message and never confirmed by anyone with the authority to change the rota. Both people believe it is sorted. Neither turns up. A form fixes it because the swap does not count until it is signed.",
      "The rule this template enforces is simple: the person picking up the shift signs before the manager does. That single ordering removes the most common failure mode, where someone drops a shift on the assumption a colleague will take it and nobody ever confirms.",
      "There is a deliberate box for the manager to check whether the swap creates a problem the two staff members cannot see — someone going over their hours, a section left without a trained keyholder, or a person working a closing shift followed by an early open. Approving swaps without that check is how you end up compliant on paper and short-staffed in practice.",
      "Keep completed forms until the pay period is closed. When someone queries their hours, the signed swap form is the whole answer and takes ten seconds to find.",
    ],
    sheet: {
      kind: "form",
      orientation: "portrait",
      headerFields: ["Venue / site", "Date of request"],
      sections: [
        {
          title: "Shift being given up",
          rows: [
            "Name of employee giving up the shift",
            "Role / section",
            "Date of shift",
            "Shift start and finish time",
            "Reason for the request",
          ],
        },
        {
          title: "Cover — to be completed by the person taking the shift",
          rows: [
            "Name of employee taking the shift",
            "Role / section",
            "Am I trained for this section? (Y/N)",
            "Hours I am already rostered this week",
            "Signature",
            "Date signed",
          ],
        },
        {
          title: "Manager approval",
          rows: [
            "Does the swap keep the section covered? (Y/N)",
            "Does it push either person over their hours? (Y/N)",
            "Is the minimum rest gap between shifts kept? (Y/N)",
            "Approved / declined",
            "Manager name",
            "Manager signature",
            "Rota updated on (date)",
          ],
        },
      ],
      footerNotes: [
        "A swap is not agreed until a manager has signed this form. A message between two staff members does not change the rota.",
        "The person taking the shift signs before the manager approves — never the other way round.",
        "File completed forms until the pay period is closed so hours queries can be settled from the paperwork.",
      ],
    },
    howToUse: [
      "Keep blank copies where staff can reach them without asking — by the rota, or in the staff room.",
      "The person giving up the shift completes the top section, including the reason.",
      "They find their own cover: the person taking the shift completes and signs the middle section.",
      "A manager checks cover, hours and rest gaps, then approves or declines and signs.",
      "Update the published rota straight away and write the date you did it on the form.",
      "Tell both people the swap is approved, and file the form with your rota records.",
    ],
    whatsIncluded: [
      "Printable PDF, portrait A4, one swap per sheet",
      "Excel (.xlsx) version for logging swaps digitally",
      "CSV version for import",
      "Separate signature blocks for the person leaving and the person covering",
      "Manager checks for cover, hours and rest gaps before approval",
      "Field for the date the rota was actually updated",
    ],
    faqs: [
      {
        q: "Who is responsible for finding cover for a swapped shift?",
        a: "In most venues the person giving up the shift finds their own cover, and this form is built that way — the middle section cannot be completed by anyone else. The manager's job is to check the swap is safe, not to source the replacement.",
      },
      {
        q: "Can a manager refuse a shift swap?",
        a: "Yes. The usual reasons are that the person covering is not trained for the section, the swap pushes someone into overtime or breaches a rest-period requirement, or it leaves a shift without a keyholder or duty manager. The approval block on the form asks each of those questions explicitly.",
      },
      {
        q: "Do we need a form if staff arrange swaps in a group chat?",
        a: "A chat message records an intention, not an approval, and it is not visible to whoever is on duty that day. If you keep swaps in chat, at minimum have the manager confirm in the same thread and update the published rota immediately.",
      },
      {
        q: "How long should we keep completed swap forms?",
        a: "Until the pay period is closed and any hours query is settled. Some operators keep them for the same period as their other rota and time records — check what your own record-keeping policy specifies.",
      },
    ],
    related: ["weekly-staff-rota", "holiday-request-form", "staff-training-record"],
    keywords: [
      "shift swap request form template",
      "shift swap form pdf free",
      "staff shift change request form",
      "hospitality shift cover form",
    ],
  },
  {
    slug: "holiday-request-form",
    category: "rota",
    name: "Holiday request form",
    h1: "Free holiday request form template",
    title: "Free Holiday Request Form Template | Rotahr",
    metaDescription:
      "Free staff holiday request form template as a printable PDF or Excel sheet. Records dates, working days requested, remaining entitlement and manager approval.",
    answer:
      "This free holiday request form template — printable PDF or editable Excel — captures the dates requested, how many working days that uses, the balance left afterwards, and the manager decision with a date, so approvals never get disputed later.",
    body: [
      "The argument about holiday is almost never about whether someone can have the time off. It is about how many days they had left, and when they asked. A form with a balance box and a date received box settles both before they become a problem.",
      "Ask for working days requested rather than calendar days. Someone requesting a Monday to Sunday off is using a different number of days depending on their contract, and writing the calendar span instead of the working days is the most common source of holiday accounting errors in small venues.",
      "The manager section asks who is covering. A holiday that is approved without cover identified is a shift that will get dropped on someone at short notice, usually the same person every time. Naming the cover at approval time is the cheapest way to stop that pattern forming.",
      "Holiday entitlement rules differ by country and by contract type, and part-time and casual staff often accrue differently. This form is a recording tool, not a calculator for your local statutory minimum — put your own entitlement figure in the balance boxes.",
    ],
    sheet: {
      kind: "form",
      orientation: "portrait",
      headerFields: ["Venue / site", "Date received"],
      sections: [
        {
          title: "Employee details",
          rows: [
            "Employee name",
            "Role / section",
            "Employment start date",
            "Holiday year runs from / to",
          ],
        },
        {
          title: "Request",
          rows: [
            "First day of leave",
            "Last day of leave",
            "First day back at work",
            "Number of working days requested",
            "Type of leave (annual / unpaid / other)",
            "Employee signature",
            "Date submitted",
          ],
        },
        {
          title: "Entitlement check",
          rows: [
            "Entitlement for this holiday year (days)",
            "Days already taken",
            "Days already approved but not yet taken",
            "Days remaining if this request is approved",
          ],
        },
        {
          title: "Manager decision",
          rows: [
            "Approved / declined / partially approved",
            "If declined or changed, reason given",
            "Who is covering these shifts",
            "Manager name",
            "Manager signature",
            "Date decided",
            "Rota and payroll updated (Y/N)",
          ],
        },
      ],
      footerNotes: [
        "Record working days requested, not calendar days — the two are different for anyone who does not work a five-day week.",
        "Entitlement rules differ by country and contract. Enter your own figures; this form does not calculate a statutory minimum for you.",
        "Give a decision in writing with a date. An unanswered request is treated as approved by most people, and that is how two chefs end up away the same week.",
      ],
    },
    howToUse: [
      "Set a notice period for requests and write it on the blank copies you hand out.",
      "The employee completes the request section, converting their dates into working days.",
      "Whoever receives the form dates it immediately — first in, first considered is the only fair way to handle clashes.",
      "Fill in the entitlement check from your holiday records before deciding anything.",
      "Approve, decline or partially approve, name who is covering, and sign with a date.",
      "Update the rota and payroll, tick the box to confirm you did, and give the employee a copy.",
    ],
    whatsIncluded: [
      "Printable PDF, portrait A4, one request per sheet",
      "Excel (.xlsx) version you can keep as a running holiday log",
      "CSV version for import",
      "Entitlement check block: allowance, taken, approved-not-taken, remaining",
      "Date received field so clashing requests are settled by order of arrival",
      "Cover and payroll-updated confirmation in the manager section",
    ],
    faqs: [
      {
        q: "How much notice should staff give for a holiday request?",
        a: "Many venues ask for twice the length of the leave — two weeks' notice for one week off — with a longer notice period over peak trading. Whatever you choose, write it on the form so the rule is visible rather than remembered differently by everyone.",
      },
      {
        q: "Should I count calendar days or working days?",
        a: "Working days. A request covering a full week uses a different number of days for a five-day contract than a three-day one, and counting calendar days is the most common cause of holiday balances drifting out of line.",
      },
      {
        q: "Can a holiday request be declined?",
        a: "Generally yes, on operational grounds, provided staff can still take their full entitlement across the holiday year and you follow whatever notice and refusal rules apply in your jurisdiction and contracts. Always write the reason on the form.",
      },
      {
        q: "How do we handle two people asking for the same week?",
        a: "Use the date received field and decide in order of arrival, subject to keeping the section covered. Having a written received date is what stops this becoming a fairness dispute.",
      },
    ],
    related: ["weekly-staff-rota", "shift-swap-request-form", "probation-review-form"],
    keywords: [
      "free holiday request form template",
      "annual leave request form pdf",
      "staff holiday form template excel",
      "time off request form hospitality",
    ],
  },
];
