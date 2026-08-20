import type { FreeTemplate } from "../types";

export const hrTemplates: FreeTemplate[] = [
  {
    slug: "new-staff-induction-checklist",
    category: "hr",
    name: "New staff induction checklist",
    h1: "Free new staff induction checklist template",
    title: "Free Staff Induction Checklist Template | Rotahr",
    metaDescription:
      "Free new staff induction checklist template for hospitality. Printable PDF and Excel covering day one, week one and month one, with sign-off from both sides.",
    answer:
      "This free new staff induction checklist template — printable PDF or editable Excel — splits induction into day one, week one and month one, with a signature from both the new starter and the manager against each stage.",
    body: [
      "Most hospitality leavers go in the first month, and the reason is usually the same: nobody told them anything. They did not know where to put their coat, who the duty manager was, when they got paid, or what \"good\" looked like on their section. An induction checklist is the cheapest retention tool in the business because it removes all of that in the first three shifts.",
      "Day one is deliberately short and practical. Fire exits, first aid, where the toilets are, how to clock in, who to call if they are sick, and one person named as the person they can ask anything. Nobody retains a two-hour policy briefing on their first day in a kitchen, and trying to deliver one is a waste of both parties' time.",
      "The signature column is not bureaucracy. If someone is later told they breached a procedure they were never shown, the signed line is the difference between a manageable conversation and an unwinnable one. It works both ways — it also stops a manager assuming allergen handling was covered when it was not.",
      "What you must legally provide to a new employee — written terms, tax and right-to-work documentation, minimum training — varies by country. The paperwork section here is a prompt to collect what your own jurisdiction requires, not a definitive list. Check your local employment rules and add the rows you need.",
    ],
    sheet: {
      kind: "checklist",
      orientation: "portrait",
      headerFields: ["Employee name", "Role / section", "Start date", "Manager / buddy"],
      columns: [
        { name: "Induction item", width: 6 },
        { name: "Done", hint: "Date", width: 2 },
        { name: "By", hint: "Initials", width: 1 },
        { name: "Staff initials", width: 1 },
      ],
      sections: [
        {
          title: "Before day one",
          rows: [
            "Written terms of employment issued and signed copy returned",
            "Right to work and identity documents checked and recorded per local requirements",
            "Tax and payroll details collected; bank details recorded securely",
            "Emergency contact and any medical or dietary information recorded",
            "Uniform issued or requirements explained; sizes recorded",
            "First shifts confirmed in writing with start time and who to ask for",
          ],
        },
        {
          title: "Day one — before they start work",
          rows: [
            "Tour: kitchen, bar, floor, toilets, staff room, lockers, smoking area",
            "Fire exits, assembly point and what to do if the alarm sounds",
            "First aid kit, accident reporting and who the trained first aiders are",
            "How to clock in and out, and what to do if they forget",
            "Break entitlement, where to take breaks, and staff food policy",
            "Who is duty manager, and one named buddy they can ask anything",
            "How to report sickness or lateness, and who to contact",
            "Pay date, pay period, payslip access and how tips are handled",
            "Rota: where it is published, when, and how to request a swap or holiday",
            "Phone, jewellery, hair and hygiene rules for their section",
          ],
        },
        {
          title: "Week one",
          rows: [
            "Food safety basics for their role: hand washing, cross-contamination, temperature checks",
            "Allergen procedure: where the information is, and exactly what to say to a guest",
            "Personal hygiene and fitness to work: reporting sickness before a shift",
            "Section walk-through: equipment they will use, and safe use of anything sharp or hot",
            "Manual handling and chemical safety for the products they will touch",
            "Cleaning schedule and their part in the open or close checklist",
            "Introduced to the whole team by name across their first shifts",
            "Menu and drinks list overview; what to do when they do not know an answer",
            "Till, ordering system or app logins created and tested",
            "First-week feedback conversation — how it is going, both ways",
          ],
        },
        {
          title: "Month one",
          rows: [
            "Formal role-specific training booked or completed and recorded on the training record",
            "Certifications required for the role identified with expiry dates logged",
            "Probation review date set and in the diary",
            "Standards conversation: what good looks like on their section",
            "Any equipment, uniform or access still outstanding chased and closed off",
            "Induction signed off as complete by manager and employee",
          ],
        },
      ],
      footerNotes: [
        "Both the manager and the new starter initial each row. A one-sided induction record is worth very little in a later dispute.",
        "Legally required new-starter paperwork differs by country. Treat the paperwork section as a prompt and add what your own rules require.",
        "Do not deliver all of this on day one. Day one is the tour, safety and the practical questions — the rest belongs in week one.",
      ],
    },
    howToUse: [
      "Print one checklist per new starter and keep it with their file, not in a shared folder.",
      "Complete the before-day-one section while they are still in onboarding, so nothing legal is outstanding on their first shift.",
      "Name a buddy on the header before they arrive and tell that person they are the buddy.",
      "Work the day one section before they start doing actual work, dating and initialling each row with them.",
      "Spread the week one rows across their first three or four shifts rather than one sitting.",
      "Set the probation review date in month one, sign the sheet off with the employee and file it.",
    ],
    whatsIncluded: [
      "Printable PDF, portrait A4, four stages from pre-start to month one",
      "Excel (.xlsx) version you can adapt to your own roles and local requirements",
      "CSV version for import",
      "Dual sign-off columns for manager and employee",
      "Hospitality-specific rows: allergens, fitness to work, section equipment, tips handling",
      "Buddy and probation review fields",
    ],
    faqs: [
      {
        q: "What should be covered on a new starter's first day in hospitality?",
        a: "Fire exits and the alarm procedure, first aid and accident reporting, how to clock in, break and staff food policy, who the duty manager is, how to report sickness, when they get paid, and one named person they can ask anything. Everything else can wait.",
      },
      {
        q: "How long should a hospitality induction take?",
        a: "Treat it as a month, not a morning. A tight day one, the safety and role training spread across week one, and a formal sign-off with a probation date set by the end of month one.",
      },
      {
        q: "Why does the employee need to initial the checklist too?",
        a: "Because a training record signed by only the manager proves an intention, not that the training happened. The employee's initial is what makes the record hold up if a procedure is later disputed.",
      },
      {
        q: "Does this cover legal onboarding requirements?",
        a: "Not by itself. Required documents, right-to-work checks and minimum training differ by country. The pre-start section prompts you to collect them; check your own local employment rules for the specific list.",
      },
    ],
    related: ["staff-training-record", "probation-review-form", "first-aid-emergency-steps"],
    keywords: [
      "free staff induction checklist template",
      "new employee onboarding checklist hospitality",
      "restaurant induction checklist pdf",
      "new starter checklist excel free",
    ],
  },
  {
    slug: "staff-training-record",
    category: "hr",
    name: "Staff training & certification record",
    h1: "Free staff training and certification record template",
    title: "Free Staff Training Record Template | Rotahr",
    metaDescription:
      "Free staff training and certification record template in PDF and Excel. Tracks food safety, allergen, first aid and licence training with dates, expiry and renewal alerts.",
    answer:
      "This free staff training and certification record template — printable PDF or editable Excel — keeps one line per person per certificate, with the date completed, the expiry date and who verified it, so nothing lapses without you noticing.",
    body: [
      "Expired certificates are found at the worst possible time: during an inspection, or after an incident. The fix is unglamorous — one sheet listing every person, every certificate, and its expiry date, reviewed monthly. This template is that sheet.",
      "Record the expiry date even when the certificate does not technically expire. Refresher intervals for food safety and first aid vary by country and by awarding body, and \"never expires\" is rarely what your own policy or insurer actually accepts. Put a review date in the column so the row still gets checked.",
      "The verified-by column exists because a certificate number typed from a photo in a group chat is not a check. Someone should have seen the certificate — original or a scan of the original — and initialled that they did. That single column is what makes the record trustworthy.",
      "Keep in-house training on the same sheet as external certificates. Section sign-offs, allergen procedure, manual handling, cellar training and till training are all things you will need to prove someone had before they were left alone with the job, and splitting them across two systems means one of them stops being maintained.",
    ],
    sheet: {
      kind: "log",
      orientation: "landscape",
      headerFields: ["Venue / site", "Reviewed on", "Reviewed by"],
      columns: [
        { name: "Employee name", width: 3 },
        { name: "Role", width: 2 },
        { name: "Training / certificate", hint: "e.g. food safety level 2, first aid, allergen, licence", width: 4 },
        { name: "Internal or external", hint: "In-house / provider name", width: 2 },
        { name: "Date completed", width: 2 },
        { name: "Expiry or review date", width: 2 },
        { name: "Certificate ref", width: 2 },
        { name: "Verified by", hint: "Initials of whoever saw the certificate", width: 1 },
      ],
      extraColumns: [
        { name: "Renewal booked", hint: "Date booked", width: 2 },
        { name: "Cost", width: 1 },
        { name: "Notes", width: 3 },
      ],
      rowCount: 18,
      footerNotes: [
        "Record an expiry or review date on every row, including for training that does not formally expire.",
        "Only initial verified-by if you have actually seen the certificate, not a message saying it exists.",
        "Review the whole sheet monthly and book renewals at least a month before the expiry date.",
      ],
    },
    howToUse: [
      "List every member of staff, with one row per certificate or training item they hold.",
      "Record whether it was in-house or from an external provider, and name the provider.",
      "Enter the completion date and the expiry or review date for every row.",
      "Initial the verified-by column only once you have seen the certificate itself.",
      "Review the sheet on the same date each month and highlight anything expiring within eight weeks.",
      "Book the renewal, write the booked date in the spreadsheet column, and update the row when it is completed.",
    ],
    whatsIncluded: [
      "Printable PDF, landscape A4, 18 rows per sheet",
      "Excel (.xlsx) version with renewal booked, cost and notes columns",
      "CSV version for import",
      "Separate columns for completion date and expiry or review date",
      "Verified-by column so certificates are checked, not assumed",
      "Works for both external certificates and in-house sign-offs",
    ],
    faqs: [
      {
        q: "What training records should a restaurant keep?",
        a: "Food safety training appropriate to each role, allergen awareness, first aid for your trained first aiders, fire safety awareness, manual handling and chemical safety, plus any licence required for your operation and role-specific in-house sign-offs.",
      },
      {
        q: "How often does food safety training need refreshing?",
        a: "Refresher intervals are set by your national requirements, your awarding body and often your own policy or insurer, and they differ between countries. Record a review date on every row and follow whichever interval applies to you.",
      },
      {
        q: "Do in-house sign-offs count as training records?",
        a: "Yes, provided they say what was covered, when, by whom, and are signed by the employee. In-house records are what you rely on to show someone was trained on your equipment and your procedures before working alone.",
      },
      {
        q: "What happens if a certificate expires?",
        a: "Treat it as expired from the date on the certificate. Depending on the qualification, that may mean the person cannot carry out a specific duty — such as being the named first aider — until it is renewed. Reviewing this sheet monthly is what prevents the surprise.",
      },
    ],
    related: ["new-staff-induction-checklist", "probation-review-form", "haccp-corrective-action-log"],
    keywords: [
      "free staff training record template",
      "training matrix template excel hospitality",
      "certification expiry tracker template",
      "employee training log pdf free",
    ],
  },
  {
    slug: "probation-review-form",
    category: "hr",
    name: "Probation review form",
    h1: "Free probation review form template",
    title: "Free Probation Review Form Template | Rotahr",
    metaDescription:
      "Free probation review form template for hospitality in PDF and Excel. Rates performance against real criteria, records objectives and the pass, extend or end decision.",
    answer:
      "This free probation review form template — printable PDF or editable Excel — scores a new starter against the things that actually matter on a hospitality floor, records agreed objectives, and captures a clear pass, extend or end decision with both signatures.",
    body: [
      "A probation review only helps if it happens before the probation period ends. Reviews held a fortnight late are, in practice, automatic passes — the decision has already been made by inaction. Set the review date on the induction sheet the day someone starts and hold it.",
      "The criteria on this form are deliberately observable: reliability, timekeeping, pace under pressure, food safety and hygiene, standards on their section, how they behave with guests, and how they take feedback. Rating someone on \"attitude\" produces a conversation nobody can act on; rating them on \"turns up on time and ready\" produces one they can do something about.",
      "Write the specific examples down. The gap between \"needs to improve consistency\" and \"three late arrivals in four weeks, all Saturday openings\" is the entire difference between a review that changes behaviour and one that gets ignored. It is also the difference that matters if the outcome is ending employment.",
      "How probation works legally — permitted length, notice, and what process you must follow to extend or end it — depends on your jurisdiction and the contract. This form documents the review; it does not tell you what your local rules allow. Check them, and take advice before ending employment.",
    ],
    sheet: {
      kind: "form",
      orientation: "portrait",
      headerFields: ["Employee name", "Role / section", "Start date", "Review date"],
      sections: [
        {
          title: "Review details",
          rows: [
            "Probation period length agreed",
            "Probation end date",
            "Reviewing manager",
            "Is this a first, interim or final review?",
          ],
        },
        {
          title: "Performance — rate 1 to 5 and give one example for each",
          rows: [
            "Reliability and attendance",
            "Timekeeping and being ready to start on time",
            "Pace and composure during service",
            "Food safety, hygiene and following procedure",
            "Quality and consistency of work on their section",
            "Guest interaction and manner (where applicable)",
            "Teamwork and communication with other sections",
            "Response to feedback and rate of improvement",
            "Care of equipment, stock and waste awareness",
          ],
        },
        {
          title: "Discussion",
          rows: [
            "What is going well — specific examples",
            "What needs to improve — specific examples",
            "Training or support the employee has asked for",
            "Employee's own view of how it is going",
            "Anything preventing them doing the job well (equipment, rota, information)",
          ],
        },
        {
          title: "Objectives to the next review",
          rows: [
            "Objective 1 and how it will be measured",
            "Objective 2 and how it will be measured",
            "Objective 3 and how it will be measured",
            "Training booked and by what date",
          ],
        },
        {
          title: "Decision",
          rows: [
            "Outcome: passed / extended / employment ending",
            "If extended, new end date and the specific reason",
            "If ending, notice given per contract and date",
            "Manager name and signature",
            "Employee signature — signing means the review took place, not necessarily agreement",
            "Date",
            "Copy given to employee (Y/N)",
          ],
        },
      ],
      footerNotes: [
        "Hold the review before the probation period ends. A late review is a pass by default.",
        "Give a specific example for every rating. Ratings without examples change nothing.",
        "Probation rules, notice and process differ by country and contract. Check your own local requirements and take advice before ending employment.",
      ],
    },
    howToUse: [
      "Set the review date when the person starts, and diary it with a week's notice for both of you.",
      "Ask the employee to think about the same criteria beforehand so it is a conversation, not an announcement.",
      "Complete the ratings before the meeting, with a written example against each one.",
      "Hold the meeting somewhere private and off the floor, not on the pass between services.",
      "Agree no more than three measurable objectives, with dates and any training booked.",
      "Record the outcome, both sign, give the employee a copy and file the original.",
    ],
    whatsIncluded: [
      "Printable PDF, portrait A4, one review per sheet",
      "Excel (.xlsx) version if you prefer to keep reviews digitally",
      "CSV version for import",
      "Nine hospitality-specific rating criteria with space for examples",
      "Objectives block with measures and dates",
      "Pass, extend or end decision with dual signatures and copy-given confirmation",
    ],
    faqs: [
      {
        q: "How long should a probation period be in hospitality?",
        a: "Three to six months is typical, and what is permitted is set by your jurisdiction and the employment contract. Whatever you choose, put the end date in writing at the start and hold the review before it arrives.",
      },
      {
        q: "What should you assess in a probation review?",
        a: "Observable things: attendance, timekeeping, pace under pressure, hygiene and procedure, quality on their section, guest manner, teamwork and how they take feedback. Score each one and write a real example beside it.",
      },
      {
        q: "Can a probation period be extended?",
        a: "Often yes, if the contract allows it and you give a specific reason and a new end date in writing. Extending without stating what has to change by when is the version that helps nobody.",
      },
      {
        q: "Does the employee have to sign the form?",
        a: "Their signature confirms the review took place and they received a copy — not that they agree with it. Note any disagreement in the discussion section rather than leaving the form unsigned.",
      },
    ],
    related: ["new-staff-induction-checklist", "staff-training-record", "holiday-request-form"],
    keywords: [
      "free probation review form template",
      "probation review template pdf",
      "employee probation assessment form excel",
      "hospitality probation review checklist",
    ],
  },
];
