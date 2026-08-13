# GetApp — default product listing copy

Same three fields as Software Advice, rewritten for the GetApp audience: functions,
specs, integrations, security. Denser and more technical, less founder story.
Combined must stay under 4000 characters — re-count after any edit.

---

## Short description

> Rotahr is a web and mobile operations platform for independent restaurants,
> bars, cafés and hotels: staff scheduling with live labour cost, time and
> attendance, table reservations, HACCP food safety records, stock and recipe
> costing, supplier ordering and receipt capture in one tenant-scoped account.

---

## Long description

> **Scheduling and labour cost.** Drag-and-drop rota with wage cost recalculating
> per change against budget, availability and approved time off in the same view,
> manager-routed swap requests, publish-to-phone, late and no-show alerts.
>
> **Time, attendance, payroll.** Phone clock in and out, rostered versus actual
> hours side by side, working-time break entitlement tracking, tips and tronc
> distribution, CSV export for your payroll provider.
>
> **Reservations and guests.** Visual floor plan with per-table shape, capacity
> and position, live status by date, click a free table to open a pre-assigned
> booking, public booking page, guest profiles built from reservation history with
> visit counts and no-show tracking.
>
> **Food safety.** Temperature checks against your own named equipment, cooking
> and cooling logs with thresholds and automatic use-by dates, editable opening,
> closing and cleaning checklists, scheduled reminders that repeat until a check
> is logged, one-click inspection pack for print or PDF.
>
> **Stock, costing, purchasing, bookkeeping.** Photograph a delivery note and AI
> extraction populates stock, expenses and the HACCP delivery check in one pass.
> Recipe costs recalculate from last landed price, so margin per dish stays live.
> Supplier order lists move draft to sent to received. Upload a supplier statement
> for automatic reconciliation against orders with discrepancies flagged. Receipt
> capture feeds P&L, tax summary and accountant CSV export.
>
> **Specs.** Next.js and React front end, PostgreSQL with Prisma, hosted on
> Vercel with a managed Postgres cluster. Responsive browser app plus native iOS
> and Android apps. Web push and mobile push for published rotas, shift changes,
> messages and due checks. EUR, GBP, USD, CAD and AUD with tax labels matching
> your jurisdiction. Multi-venue under one account.
>
> **Integrations.** Google sign-in via OAuth. Gmail connection so booking
> enquiries land in an assisted inbox. Square and Lightspeed POS sales sync via
> OAuth, tokens encrypted at rest. Transactional email. CSV in and out across
> payroll, expenses, orders and guests. Subscription billing runs through a
> merchant of record, so no card data reaches Rotahr.
>
> **Security.** Every record query is scoped to your business ID server side, not
> filtered in the client. Three roles: staff, manager, admin. Passwords hashed
> with bcrypt, JWT sessions expiring after eight hours, rate-limited auth
> endpoints, OAuth tokens encrypted with AES-256-GCM. TLS in transit, encrypted
> at rest. Soft delete on financial records, guest data anonymisation on request,
> scheduled purge of stored receipt images. Privacy programme covers GDPR, UK
> GDPR, CCPA and CPRA, PIPEDA and the Australian Privacy Act.
>
> **Not included.** No point of sale, no customer payment processing, no
> table-side ordering, no course or training content. Rotahr runs alongside your
> till.
>
> First month free, no card required. Support comes from the founder directly.

---

## Target market

> Independent hospitality operators and small groups: restaurants, bars,
> gastropubs, cafés and hotels with food and beverage service. Typically four to
> thirty staff on one site, scaling to multi-venue groups on one account. Used in
> Ireland, the UK, the US, Canada and Australia.
>
> Best fit is the owner-operator or general manager replacing a paper rota, a
> WhatsApp group, a folder of food safety sheets and a box of receipts with one
> system. Buyers who want an audit trail and role separation rather than
> spreadsheets get the most out of it. Less suited to large chains needing deep
> POS integration or centralised procurement.

---

## Notes for the form

- Square and Lightspeed sync is shipped code but depends on partner
  credentials per provider. If a reviewer asks for a live demo of it, say it is
  in rollout rather than claiming a finished integration.
- "Supplier ordering" is purchase orders to suppliers, never customer or
  table-side ordering. Correct that reading immediately if it comes up.
- Everything else above is verified against shipped code (August 2026).

---

## Tagline

Pick one. Character count in brackets — portal taglines are usually capped near
100, and the shorter ones survive being truncated in search listings.

> One app to run your entire venue. [33]

Alternatives, same claim, different angle:

> Rota, bookings, food safety and stock in one app. [49]
> Back of house, handled. Built by a chef. [40]
> Everything behind the till, in one place. [41]
> Run the venue from your phone, between tasks. [45]

Recommended: **One app to run your entire venue.** It already leads the site, so
the listing and the landing page tell buyers the same thing.

---

## Key benefits

Benefit first, mechanism second — each line says what the operator gets, then why
it is believable. Trim from the bottom if the field is short.

> **See labour cost before you commit to it.** Wage cost recalculates against
> budget as you drag shifts, so you fix an over-budget week while it is still a
> draft rather than finding out on the payroll run.
>
> **Pass an inspection without the folder.** Temperature, cooking, cooling,
> cleaning and opening checks are logged on a phone against your own named
> equipment, reminders repeat until a check is actually done, and the inspection
> pack is one click.
>
> **Know your margin per dish today, not last quarter.** Photograph a delivery
> note and the line items update stock, expenses and your HACCP delivery check at
> once — recipe costs move with the prices that actually landed.
>
> **Fill the room from a floor plan that matches it.** Tables laid out as they
> really sit, live status per date, and a public booking page. Guest profiles,
> visit counts and no-show history build themselves from bookings.
>
> **Stop paying for five subscriptions.** Scheduling, time and attendance,
> reservations, food safety, stock, purchasing and receipt capture are one price
> and one login, replacing the paper rota, the WhatsApp group and the shoebox.
>
> **Get answers from the person who built it.** Support comes from the founder, a
> former chef, with no ticket queue. First month free, no card required.

---

## Notes on tagline and benefits

- Benefit six is the differentiator most reviewers latch onto; keep it last so it
  is the closing impression, but never cut it.
- Do not turn "stop paying for five subscriptions" into a named competitor
  comparison in the listing — save that for `/compare`, where it is qualified.
