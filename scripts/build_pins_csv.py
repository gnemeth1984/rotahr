#!/usr/bin/env python3
"""
Build the Pinterest bulk-upload CSV for the Rotahr free template library.

Column spec per Pinterest Business help ("Bulk upload Pins"):
  Title (required)          100 chars max
  Media URL (required)      public URL to the image file (ends .png/.jpg)
  Pinterest board (required) board name, or "Board/Section"
  Thumbnail                 video only -- left blank
  Description               500 chars max
  Link                      destination URL
  Publish date              yyyy-mm-dd or yyyy-mm-ddTHH:MM:SS, blank = immediate
  Keywords                  comma separated

Usage: python3 scripts/build_pins_csv.py
Output: /home/user/rotahr-pins/pinterest-pins.csv
"""

import csv
import datetime
import json
import os
import sys

CATALOG = "/tmp/templates.json"
OUT_CSV = "/home/user/rotahr-pins/pinterest-pins.csv"
IMG_BASE = "https://rotahr.com/pins"
LINK_BASE = "https://rotahr.com/templates"

# Keyword-named boards -- Pinterest treats board names as ranking signal.
BOARDS = {
    "haccp": "HACCP & Food Safety Templates",
    "rota": "Staff Rota & Scheduling Templates",
    "open-close": "Opening & Closing Checklists",
    "safety": "Restaurant Health & Safety",
    "cleaning": "Cleaning Schedules & Checklists",
    "hr": "Hospitality Staff & HR Templates",
    "stock": "Stock Control & Ordering",
    "bar": "Bar & Cellar Management",
    "hotel": "Hotel & Housekeeping Templates",
    "finance": "Restaurant Finance & Tips",
}

# Hand-written per pin. Title <=100 chars, front-loaded (first ~40 show in feed).
# Description <=500 chars, keyword-rich, no country-specific legal claims.
PINS = {
    "fridge-freezer-temperature-log": (
        "Free Fridge & Freezer Temperature Log Template (PDF + Excel)",
        "A free fridge and freezer temperature log template you can print or edit in Excel. "
        "One page per week, a row for every named unit, and an AM and PM reading column so two "
        "checks a day are recorded properly. Includes a corrective action column wide enough to "
        "actually write in -- the bit most HACCP temperature logs leave out. Widely used targets "
        "are pre-printed: 0-5C chilled, -18C frozen. Download free, no email needed.",
    ),
    "cooking-cooling-temperature-log": (
        "Free Cooking & Cooling Temperature Log Template for Kitchens",
        "Track core temperatures from cook to chill on one sheet. This free cooking and cooling "
        "log template records batch name, start and end times, core temp and the use-by date that "
        "goes on the label. Separate cook and cool rows mean one batch is traceable through both "
        "steps. Printable PDF or editable Excel with the elapsed-time formula already in. Free "
        "download, no signup.",
    ),
    "delivery-check-record": (
        "Free Delivery Check Record Template (Goods In Temperature Log)",
        "Log every delivery as it lands. This free goods-in delivery check record template covers "
        "supplier, temperature, packaging condition, date codes and vehicle cleanliness, with a "
        "wide reject reason column for supplier disputes and credit notes. Fifteen delivery rows "
        "per week. Printable PDF, editable Excel or CSV. Free, no email required.",
    ),
    "haccp-corrective-action-log": (
        "Free HACCP Corrective Action Log Template — Printable PDF",
        "Recording a failed check is only half the job -- you have to show what you did about it. "
        "This free HACCP corrective action log template gives you a dated record of the deviation, "
        "the action taken, who signed it off and how it was prevented next time. The page "
        "inspectors ask for and most kitchens do not have. Printable PDF or editable Excel. Free "
        "download.",
    ),
    "weekly-staff-rota": (
        "Free Weekly Staff Rota Template — Printable PDF & Excel",
        "A clean weekly staff rota template that fits one page. Seven days across, staff down the "
        "side, with hours totalled per person and a wage cost column so you can see the labour "
        "spend before you publish it. Works for restaurants, bars, cafes and hotels. Print it for "
        "the staff room or edit the Excel version. Free download, no email needed.",
    ),
    "shift-swap-request-form": (
        "Free Shift Swap Request Form Template for Hospitality",
        "Stop agreeing shift cover by text and losing track of who is actually on. This free shift "
        "swap request form template records the shift being given up, who is picking it up, both "
        "signatures and the manager approval. One page, print a stack and leave them by the rota. "
        "PDF, Excel or CSV. Free download, no signup.",
    ),
    "holiday-request-form": (
        "Free Holiday Request Form Template (Annual Leave, PDF + Excel)",
        "A one-page holiday request form template for hospitality teams. Records the dates "
        "requested, working days used, who is covering, and the entitlement check -- allowance, "
        "taken, approved not taken, remaining -- so decisions are made on real numbers. Has a date "
        "received field so clashing requests are settled by order. Free printable PDF or editable "
        "Excel.",
    ),
    "kitchen-opening-closing-checklist": (
        "Free Kitchen Opening & Closing Checklist Template (Printable)",
        "The checklist that stops the two calls no chef wants: the gas left on and the walk-in left "
        "open. A free kitchen opening and closing checklist template covering fridge temps, probe "
        "checks, equipment on and off, waste out, floors, and the final lock-up signature. "
        "Printable PDF for the wall or editable Excel to match your own kitchen. Free download.",
    ),
    "bar-opening-closing-checklist": (
        "Free Bar Opening & Closing Checklist Template — Printable PDF",
        "Set up, cash down, lock up -- in order, every shift. This free bar opening and closing "
        "checklist template covers cellar and line checks, glassware, ice, garnish and stock prep, "
        "then till reconciliation, spirit measures, waste and security on close. Built for pubs, "
        "bars and hotel bars. Printable PDF or editable Excel. Free, no email needed.",
    ),
    "front-of-house-opening-closing-checklist": (
        "Free Front of House Opening & Closing Checklist Template",
        "Floor ready before doors open, reset done before anyone goes home. A free front of house "
        "opening and closing checklist template covering table setups, station stock, menus, "
        "toilets, booking checks and the end-of-night reset. Gives new starters a standard to "
        "follow without asking. Printable PDF or editable Excel. Free download, no signup.",
    ),
    "first-aid-emergency-steps": (
        "Free First Aid & Emergency Steps Poster for Kitchens (Printable)",
        "Print it, laminate it, put it where people can see it. A free first aid and emergency "
        "steps poster covering burns and scalds, deep cuts, choking, eye splashes and when to call "
        "for help -- written for a busy kitchen, not a classroom. Space to write your own emergency "
        "numbers, first aider name and assembly point. Free printable PDF. No email required.",
    ),
    "fire-safety-checklist": (
        "Free Fire Safety Checklist Template for Restaurants & Kitchens",
        "A free fire safety checklist template for commercial kitchens and hospitality venues. "
        "Weekly and monthly checks on extinguishers, blankets, suppression systems, exit routes, "
        "signage, emergency lighting and alarm tests, each signed and dated so you have a record if "
        "you are ever asked. Printable PDF or editable Excel. Free download.",
    ),
    "accident-incident-report-form": (
        "Free Accident & Incident Report Form Template (Workplace, PDF)",
        "Record it properly the first time. A free accident and incident report form template for "
        "hospitality: what happened, where, injury detail, first aid given, witnesses, and the "
        "follow-up action to stop it happening again. One page per incident so your accident book "
        "stays readable. Printable PDF or editable Excel. Free, no signup.",
    ),
    "daily-weekly-cleaning-schedule": (
        "Free Cleaning Schedule Template for Restaurants (Daily + Weekly)",
        "Who cleans what, when, and who initialled it. A free daily and weekly cleaning schedule "
        "template for kitchens, bars and dining rooms -- tasks down the side, days across the top, "
        "initials in the box. Splits daily jobs from weekly ones so nothing quietly stops getting "
        "done. Printable PDF for the wall or editable Excel to match your venue. Free download.",
    ),
    "deep-clean-schedule": (
        "Free Deep Clean Schedule Template for Commercial Kitchens",
        "Deep cleaning planned instead of panicked. A free deep clean schedule template covering "
        "extraction and canopies, ovens and fryers, behind and under the line, walk-ins, shelving "
        "and drains -- each with a frequency, a date last done and a date next due. Print it or "
        "edit the Excel version. Free download, no email needed.",
    ),
    "new-staff-induction-checklist": (
        "Free New Staff Induction Checklist Template for Hospitality",
        "Day one done properly. A free new staff induction checklist template covering paperwork, "
        "uniform, food safety and allergen basics, fire exits and first aid, systems and logins, "
        "who to ask, plus the day-one, week-one and month-one review points. Both the new starter "
        "and the manager sign it. Printable PDF or editable Excel. Free download.",
    ),
    "staff-training-record": (
        "Free Staff Training Record & Certificate Expiry Tracker Template",
        "A free staff training record template built as a matrix: staff down the side, training "
        "across the top, date completed and expiry date in the box. Covers food safety, allergens, "
        "manual handling, fire, first aid and licensing certificates so you spot an expiry before "
        "it lapses rather than after. Printable PDF or editable Excel. Free, no signup.",
    ),
    "probation-review-form": (
        "Free Probation Review Form Template for Hospitality Staff",
        "A fair written review instead of a corridor conversation. This free probation review form "
        "template scores the things that actually matter in hospitality -- reliability, pace under "
        "pressure, standards, teamwork, attitude to feedback -- with space for evidence, the "
        "employee's own comments and a clear pass, extend or end outcome. Printable PDF or editable "
        "Excel.",
    ),
    "stock-count-sheet": (
        "Free Stock Count Sheet Template for Restaurants & Bars (Excel)",
        "Count once, write once. A free stock count sheet template with columns for opening stock, "
        "deliveries in, closing count, usage and value, grouped by section so you can hand a page "
        "to each area and count in parallel. Works for kitchen, bar and dry store. Printable PDF, "
        "editable Excel with the totals already formulated, or CSV. Free download.",
    ),
    "wastage-log": (
        "Free Food Waste Log Template for Kitchens & Bars (Printable)",
        "Find out what you are actually throwing away. A free wastage log template recording item, "
        "quantity, value, reason -- spoilage, over-prep, dropped, comped, returned -- and who "
        "logged it, so you can see the pattern instead of guessing. Costs the waste out weekly. "
        "Printable PDF or editable Excel. Free download, no email needed.",
    ),
    "par-level-order-sheet": (
        "Free Par Level Order Sheet Template — Stop Over-Ordering",
        "Set the par once, order the gap. A free par level order sheet template listing each item "
        "with its par level, current count and the resulting order quantity worked out for you, "
        "grouped by supplier so one sheet becomes one order. Cuts over-ordering and the deliveries "
        "you forget you placed. Printable PDF, editable Excel or CSV. Free.",
    ),
    "cellar-check-line-cleaning-log": (
        "Free Beer Line Cleaning Log & Cellar Check Sheet Template",
        "Cellar temperatures and line cleans on one signed sheet. A free cellar check and line "
        "cleaning log template recording cellar temp, cooler checks, gas levels, which lines were "
        "cleaned, the date last cleaned and the date next due, with initials against each. Keeps "
        "the quality argument and the audit trail in one place. Printable PDF or Excel. Free.",
    ),
    "spirit-stocktake-sheet": (
        "Free Spirit Stocktake Sheet Template for Bars (Excel + PDF)",
        "A free spirit stocktake sheet template that gets you to a variance number without a "
        "spreadsheet fight. Bottle and part-bottle counts, unit size, expected versus actual usage "
        "and the variance in plain figures, laid out by shelf so counting follows the back bar. "
        "Printable PDF, editable Excel with the variance formula in, or CSV. Free download.",
    ),
    "housekeeping-room-checklist": (
        "Free Housekeeping Room Checklist Template for Hotels & B&Bs",
        "A room-ready standard your team can follow without asking. This free housekeeping room "
        "checklist template walks bed and linen, bathroom, surfaces and touchpoints, amenities and "
        "restock, then the final walk-through, with a signature and room number per sheet. Works "
        "for hotels, guesthouses and B&Bs. Printable PDF or editable Excel. Free download.",
    ),
    "guest-incident-log": (
        "Free Guest Incident & Complaint Log Template for Hotels",
        "Track what happened, what you did and how it ended. A free guest incident and complaint "
        "log template recording date, room or table, the guest issue, immediate action, "
        "compensation or gesture given, who handled it and whether it is resolved or still open. "
        "Shows patterns instead of one-off apologies. Printable PDF or editable Excel. Free.",
    ),
    "daily-takings-sheet": (
        "Free Daily Takings Sheet Template — Cash Up in Five Minutes",
        "Cash up without the arguments. A free daily takings sheet template covering opening float, "
        "cash, card and other payment totals, voids and refunds, safe drop and the variance worked "
        "out at the bottom, with a manager signature. One page per day so a discrepancy is traced "
        "to a shift, not a week. Printable PDF, editable Excel or CSV. Free download.",
    ),
    "tips-tronc-distribution-sheet": (
        "Free Tips & Tronc Distribution Sheet Template (Fair Tip Pooling)",
        "Split tips transparently and have the paper to show it. A free tips and tronc distribution "
        "sheet template with hours worked per person, the pool total, share weighting by role, and "
        "the amount each person receives calculated for you, plus a signature column. Ends the "
        "who-got-what conversation. Printable PDF, editable Excel or CSV. Free download.",
    ),
}

# Publish schedule: 2 pins/day so the account does not look like a dump.
START_DATE = datetime.date(2026, 8, 21)
SLOTS = ["10:00:00", "19:00:00"]

BROAD_KEYWORDS = ["free template", "hospitality", "restaurant management"]


def main():
    with open(CATALOG) as f:
        cat = json.load(f)

    templates = cat["templates"]
    missing = [t["slug"] for t in templates if t["slug"] not in PINS]
    if missing:
        print("MISSING PIN COPY: %s" % ", ".join(missing))
        return 1

    os.makedirs(os.path.dirname(OUT_CSV), exist_ok=True)
    rows, warnings = [], []

    for i, tpl in enumerate(templates):
        slug = tpl["slug"]
        title, desc = PINS[slug]
        board = BOARDS[tpl["category"]]

        if len(title) > 100:
            warnings.append("TITLE too long (%d): %s" % (len(title), slug))
        if len(desc) > 500:
            warnings.append("DESC too long (%d): %s" % (len(desc), slug))

        day = START_DATE + datetime.timedelta(days=i // len(SLOTS))
        publish = "%sT%s" % (day.isoformat(), SLOTS[i % len(SLOTS)])

        keywords = list(tpl.get("keywords", [])) + BROAD_KEYWORDS
        seen, uniq = set(), []
        for k in keywords:
            if k.lower() not in seen:
                seen.add(k.lower())
                uniq.append(k)

        rows.append(
            {
                "Title": title,
                "Media URL": "%s/%s.jpg" % (IMG_BASE, slug),
                "Pinterest board": board,
                "Thumbnail": "",
                "Description": desc,
                "Link": "%s/%s" % (LINK_BASE, slug),
                "Publish date": publish,
                "Keywords": ", ".join(uniq),
            }
        )

    fields = [
        "Title",
        "Media URL",
        "Pinterest board",
        "Thumbnail",
        "Description",
        "Link",
        "Publish date",
        "Keywords",
    ]
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    print("wrote %s (%d pins)" % (OUT_CSV, len(rows)))
    print(
        "title len: max %d | desc len: max %d"
        % (
            max(len(r["Title"]) for r in rows),
            max(len(r["Description"]) for r in rows),
        )
    )
    print("boards: %d" % len(set(r["Pinterest board"] for r in rows)))
    print(
        "publish window: %s -> %s"
        % (rows[0]["Publish date"], rows[-1]["Publish date"])
    )
    for w_ in warnings:
        print("!! " + w_)
    return 1 if warnings else 0


if __name__ == "__main__":
    sys.exit(main())
