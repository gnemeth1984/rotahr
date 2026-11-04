# Lead Intelligence

A daily, super-admin-only research assistant that finds Irish and UK hospitality venues, analyses
public evidence about them, scores them, and prepares **draft** outreach for a human to review.

The automated run never contacts anyone. An email goes out only when a super-admin presses
**Send now** on one lead and confirms (see *Send now* below). Calls are placed by the admin from
their own phone and logged by hand. Records are never copied into `OutreachLead` or handed to the
automated outreach sequence, so nothing follows up on its own.

## What runs, and when

Two crons, both in `vercel.json`:

| Route | Schedule (UTC) | What it does | Paid calls |
|---|---|---|---|
| `GET /api/cron/lead-intelligence-sources` | `30 5 * * *` | Free trigger sources: FSAI enforcement orders (weekly) and UK FHRS hygiene ratings (daily, 3 authorities) | none |
| `GET /api/cron/lead-intelligence` | `0 6 * * *` | Job-advert discovery, Maps discovery, analysis and drafts | Serper + OpenAI, within the caps |

The sources run goes first so its leads are already scored when the paid run picks its analysis
queue (highest lead score first).

- Vercel cron runs in **UTC**, so this is 06:00 UTC: 07:00 in Ireland/UK during summer time and
  06:00 in winter. Vercel crons cannot follow DST. For a fixed 06:00 local time all year, change
  the schedule twice a year (`0 5 * * *` in summer) or call the route from a scheduler that is
  aware of timezones.
- The route requires `Authorization: Bearer $CRON_SECRET`, compared in constant time. If
  `CRON_SECRET` is missing, every request is refused.
- If `LEAD_INTELLIGENCE_ENABLED` is not `true`, the route returns `{skipped:true}` and makes no
  calls. If either provider key is missing, it returns 503 and starts no run.

Each run has these steps:

1. **Discover (trigger first).**
   - **Job adverts:** four Serper Google searches limited to the last month (`tbs: qdr:m`),
     rotating towns by UTC day: chef roles and management roles in an Irish town, chef roles in a
     UK town, then either UK management roles or (every other day) a national HACCP / food-safety
     role search. One `gpt-4o-mini` call extracts named employers from the snippets. Every advert
     is then verified in code: the quote, venue name and role must appear in the snippet, and
     agencies, job boards and "our client" employers are dropped. Job-board pages themselves are
     never fetched. Each verified advert becomes a lead (`sourceKind: job_advert`) with a dated
     hiring signal.
   - **Maps:** one Serper Maps search per day, alternating Ireland and the UK. A result is kept
     only if its address can be shown to be in the requested country (Eircode, county, `BT` or
     UK postcode, or a country name).
   - The old "directories" web search was removed in v2 to pay for the job searches.
   - Seeds are also read, **read-only**, from the existing `CallLead`, `VenueCandidate` and
     `OutreachLead` tables. Email addresses from those tables are not reused as evidence.
2. **Save.** New venues are written to `LeadIntelligenceLead`, with deduplication (see below).
3. **Analyse.** The queue holds leads due for analysis, **highest lead score first**, then
   never-analysed first, up to 5 per run.
   Suppressed, converted and not-interested leads are skipped. For each lead the run does the
   following:
   - one web search;
   - a polite crawl of the venue's own site, if it has one (robots.txt, same site only, up to 4
     pages: home, contact, about and careers/vacancies, with SSRF guards and a size cap);
   - one AI extraction call, whose quotes are then checked against the source text.
4. **Score and draft.** Scores and drafts are computed deterministically from the validated
   facts. If fit cannot be established, no drafts are written.
5. **Record.** Each analysis is stored in `LeadIntelligenceAnalysis` with its facts, scores,
   sources and reasoning. The lead row gets its latest scores, and the next analysis is due in
   7 days. The run summary is stored in `LeadIntelligenceRun`.

## Lead score and grades (Lead Engine v2)

The lead score answers "how likely is this venue to buy this month". It is built only from dated,
sourced **trigger signals** (`LeadIntelligenceSignal`), one row per signal with points, event date
and source URL. It is separate from the fit/intent/priority scores below, which still describe the
analysis.

| Signal | Points | Source | Counts for |
|---|---|---|---|
| Hiring a compliance role (HACCP, Food Safety, Quality Manager) | 50 | job advert | 60 days |
| Hiring a chef role (Head/Executive/Sous Chef, Kitchen Manager) | 40 | job advert | 60 days |
| Hiring a management role (Restaurant/General/Duty/Operations Manager) | 35 | job advert | 60 days |
| FHRS rating 0, 1 or 2 | 70 | FHRS API | latest inspection |
| FHRS rating 3 | 40 | FHRS API | latest inspection |
| FHRS rating 4 / 5 | 10 / 0 | FHRS API | latest inspection |
| FSAI Closure Order | 100 | FSAI list | 180 days |
| FSAI Prohibition Order | 90 | FSAI list | 180 days |
| FSAI Improvement Order | 75 | FSAI list | 180 days |
| Multiple sites (observed in the analysis) | 20 | analysis | while observed |

- Signals are grouped (chef, management, compliance, hygiene, enforcement, multi-site). **Only
  the strongest active signal per group counts**, so two chef adverts are still 40. For hygiene
  the latest inspection wins even if an older one scored higher.
- Groups add up: a Head Chef advert plus a Closure Order is 140.
- Output stored on the lead (`leadScore`, `grade`, `signalSummary`):
  `{"lead_score":110,"signals":["Food Hygiene Rating 2","Hiring Head Chef"]}`.

| Grade | Lead score | Pursued |
|---|---|---|
| `A+` | ≥ 90 | yes |
| `A` | 70–89 | yes |
| `B` | 40–69 | yes |
| `C` | 20–39 | no |
| `D` | < 20 | no |

Pursued means A+, A and B. The **Top 50 to buy this month** view (`view=buy`) lists pursued
leads that are still open (not contacted-closed, suppressed, converted or not interested),
ordered by lead score, then priority, then fit.

The FHRS reason shown in the UI is: "Poor hygiene rating. Rotahr HACCP records may help support
future inspections."

### Free trigger sources

**FHRS (UK Food Hygiene Rating Scheme).** `lib/lead-intelligence/fhrs.ts`, public API
`api.ratings.food.gov.uk` (no key).

- England, Wales and Northern Ireland only (FHRS-scheme authorities). Scotland uses FHIS
  (Pass / Improvement Required) and is excluded; Scottish towns are covered by job searches only.
- Business types (`FHRS_BUSINESS_TYPES`): Restaurant/Cafe/Canteen (1), Hotel/B&B/guest house
  (7842), Pub/bar/nightclub (7843) and Other catering premises (7841). Takeaways (7844) and
  mobile caterers (7846) are excluded.
- Each run takes the next 3 (town, authority) units from `FHRS_UNITS` (42 UK towns; London is 9
  boroughs), fetches every venue rated 0–3, stores them in `LeadIntelligenceFhrs`, and promotes up
  to 40 records rated within the last 3 years to leads (`sourceKind: fhrs`). The cursor is in
  `LeadIntelligenceSourceSync` (`source: fhrs`).
- A venue that disappears from a complete authority list has been re-rated 4–5 or closed. Its
  record becomes `rating: "superseded"` and its signal is deleted, so the score drops. A failed
  page never supersedes anything.

**FSAI (Ireland enforcement orders).** `lib/lead-intelligence/fsai.ts`, the public Closure,
Prohibition and Improvement PDFs linked from `fsai.ie/enforcement-and-legislation/enforcement`.

- Runs **weekly** (the admin button can force it). FSAI removes lifted orders from its lists, so
  every order is persisted in `LeadIntelligenceFsaiOrder` on first sight.
- PDFs are parsed with `unpdf` text coordinates against the column header. A page whose layout is
  not recognised is skipped and reported in the run status; it is never guessed.
- Only hospitality business types (restaurant, café, takeaway, hotel, pub, bar, caterer, service
  sector, mobile) are promoted to leads (`sourceKind: fsai`). Retailers, manufacturers and
  distributors are stored but never promoted.
- The **Served On** column (often a private person's name) is never stored.

**Cross-matching.** When a lead arrives from a job advert or Maps, `attachKnownRecords` looks for
the same normalised name in the same UK town (FHRS, postcode must match when both have one) or the
same Irish county (FSAI). Ambiguous matches (two same-name premises) are skipped.

**Locking.** `runSourceImports` holds a lease on the `lock` row of `LeadIntelligenceSourceSync`;
an overlapping call returns `{skipped:true}`. A lease older than 10 minutes is taken over.

### Hygiene and enforcement never appear in outreach

AI evidence for FHRS and FSAI leads contains identity only (name, address, business type), never
the rating or the order. Drafts may mention hiring ("noticed you're hiring a Head Chef"), but
`assertNoForbiddenTerms` rejects any draft that mentions hygiene, ratings, inspections,
enforcement, closure, prohibition, FSAI or FHRS (the venue's own name is exempt). The detail page
shows these signals with a "never mention in outreach" note.

## Fit, intent and priority (analysis scores)

| Score | Range | Built from |
|---|---|---|
| Fit | 0–100, or `null` | hospitality 20, food service 20, shift staffing 20 (15 if inferred), HACCP relevance 15 (implied by food prep), service variety up to 15, complexity up to 10 |
| Intent | 0–100 | recruitment 25, expansion 25, investment 20, new opening 20, management hiring 10. Counted **only when observed**, then discounted by event age (unknown date ×0.5, older than 90 days ×0.5, older than a year ×0.25). The same quote is never counted twice. |
| Complexity | 0–10 | food 2, multiple locations 2, beverage, events, entertainment, functions, departments and 7-day opening 1 each |
| Reachability | 0–100 | email 30, phone 30, Facebook 15 (7 without a dated recent post), Instagram 10 (5 without one), contact form 10, LinkedIn 5 |

**Priority** = fit×0.5 + intent×0.3 + reachability×0.2.

**Classification:**

| Class | Rule |
|---|---|
| `A+` | fit ≥ 80 and reachability ≥ 80 |
| `A` | fit ≥ 70 |
| `B` | fit ≥ 50 |
| `C` | anything else with a known fit |
| `UNQUALIFIED` | identity or hospitality could not be confirmed. This means "not enough evidence", not "bad prospect". |

**Intent status:** `unknown` when intent is 0, then Cold (1–25), Warm (≤50), Interested (≤75)
and Hot. Unknown intent is never shown as Cold, and it never lowers fit.

### Evidence rules

- Every signal and contact must carry a source URL and an exact quote that appears in a fetched
  document. Anything the model cannot cite is discarded.
- Contacts are never invented, guessed (no `info@`) or derived from an email address. A contact
  counts only in one of these cases:
  - it is on the venue's own site;
  - it is on the venue's Maps record;
  - the venue's name appears within about 400 characters of the quote.
- Directory-domain emails are rejected.
- Identity requires the venue name and its location in the same document. Same-name venues
  elsewhere are rejected.
- The decision-maker suggestion, staff and location counts, and the contact reason are
  **estimates** and are labelled as estimates in the UI and in the stored reasoning.

### Drafts

Each analysed lead gets a cold email (≤120 words), a follow-up (≤120 words) and a phone opener,
written from validated facts only. Each has a Copy button; the two emails also have **Send now**.

### Send now

`POST /api/admin/lead-intelligence/send` (super-admin, same-origin) sends one email to one lead via
the existing Brevo outreach sender (`lib/outreach/brevo.ts`, From `OUTREACH_FROM_EMAIL`, default
`gabornemeth@rotahr.com`, which forwards into sales@). The composer lets the admin pick a published
address (manager, general, reservations) or type one, and edit the subject and body before a
confirm step. Server-side, in order (`lib/lead-intelligence/send.ts`):

1. `BREVO_API_KEY` must be set, otherwise 503 `not_configured` and the button is disabled.
2. The lead must not be `suppressed`, `not_interested` or `converted`.
3. The address must be valid, routable and not on the suppression list (`EmailSuppression`).
4. The live demo (`rotahr.com/try`) and tutorials (`rotahr.com/tutorials`) links, with UTM tags,
   are inserted above the sign-off if the body doesn't already link to them.
5. A second **cold** email to an already-contacted lead needs an explicit "Send anyway" (`force`).
6. The daily cap (`OUTREACH_DAILY_LIMIT`, default 25) is **shared** with the automated outreach
   through `OutreachDailyCount`.
7. MX check (`lib/outreach/mx-check.ts`); a domain with no mail route is refused.
8. Sent with an unsubscribe footer and List-Unsubscribe / one-click headers. A permanent Brevo
   rejection suppresses the address.

On success the lead becomes `contacted`, `contactedAt` is stamped and a line with the Brevo
message id is appended to Notes. `{action:"call", leadId, outcome}` on the same route logs a phone
call the same way. `GET` on the route returns `{configured, from, dailyLimit, sentToday}` and sends
nothing.

### Deduplication

A seed matches an existing lead in either of these cases:

- **Exact key:** country + normalised name + normalised address (or city, when there is no
  address).
- **Fallback:** same country, name and city when either of these holds:
  - the normalised addresses are equal;
  - exactly one such venue exists and one of the two has no address.

Two same-name venues in one city are never merged on an empty address. Concurrent inserts are
resolved through the unique key (P2002). Enrichment only fills in a missing website. It never
resets status, notes or contact state.

## Budgets and safety limits

| Limit | Value |
|---|---|
| Run deadline | 240 s (the function's `maxDuration` is 300 s) |
| Per run | 10 searches, 6 AI calls, ≤5 analyses, ≤30 discoveries saved |
| Per-run split | 4 job searches + 1 Maps search + 1 per analysis; 1 advert-extraction AI call + 1 per analysis |
| Free sources | FHRS and FSAI make no paid calls and are outside these caps |
| Per UTC day, across cron, retries and manual runs | 30 searches, 18 AI calls by default |
| Model input | ≤42,000 characters per analysis, ≤12,000 per document |

- Spend is written to the run row **before** each paid call returns, so a timed-out function
  still counts toward the daily cap.
- **Mutex:** a unique `activeLock` stops overlapping runs. A lease older than 10 minutes is
  released and marked failed.
- **Idempotency:** the cron run key is `daily:YYYY-MM-DD` (UTC). A completed or partial daily run
  is not repeated. A failed one is retried under the same key and carries its earlier spend.
- **Run status:**
  - `completed` means there were no real failures. Budget stops and skipped Maps results are
    recorded as notices.
  - `partial` means some failures occurred but some work was saved.
  - `failed` means failures occurred and nothing was saved.
- If an admin changes a lead to suppressed, converted or not interested **while** it is being
  analysed, the admin's change stands and that analysis is discarded.

## Configuration

Set these in the deployment environment. Names only; values are never logged or returned.

| Variable | Required | Purpose |
|---|---|---|
| `LEAD_INTELLIGENCE_ENABLED` | yes (`true`) | Opt-in switch. Anything else disables cron and manual runs. |
| `SERPER_API_KEY` | yes | Serper Maps and web search |
| `OPENAI_API_KEY` | yes | `gpt-4o-mini` JSON extraction |
| `CRON_SECRET` | yes | Bearer token Vercel sends to cron routes. Already used by the existing crons. The sources cron needs only this and `LEAD_INTELLIGENCE_ENABLED`. |
| `DATABASE_URL` | yes | Existing |
| `LEAD_INTELLIGENCE_ANALYSIS_LIMIT` | no | Analyses per run, 1–5 (default 5) |
| `LEAD_INTELLIGENCE_DISCOVERY_LIMIT` | no | Discoveries saved per run, 1–30 (default 20) |
| `LEAD_INTELLIGENCE_DAILY_QUERY_CAP` | no | Searches per UTC day, 1–100 (default 30) |
| `LEAD_INTELLIGENCE_DAILY_MODEL_CAP` | no | AI calls per UTC day, 1–60 (default 18) |

## Admin UI

The UI is for super-admins only. It checks `isSuperAdminEmail` on both the server pages and the
APIs. Mutations also get same-origin checks.

- **`/admin?tab=lead-intelligence`** is the main tab, also reachable from the sidebar under
  Platform → Lead Intelligence. It has:
  - four stat cards that double as view filters: Hot Prospects, Recently Qualified (last 7
    days), Ready To Contact and Email Drafts Ready;
  - today's summary with the top 10 prospects;
  - a **Top 50 to buy this month** card (grades A+/A/B, open leads, by lead score);
  - grade counts and FHRS / FSAI source status (last run, result) in the summary;
  - a table sorted by lead score, with Lead score, Grade and Signals columns, filterable by
    search, country, county, grade (or "pursued"), trigger signal (hiring, FHRS, FSAI,
    multi-site), classification, minimum fit, intent and priority, intent status, and contacted;
  - "Add business", "Run now" and **Import FSAI / FHRS** buttons (the import button calls the
    free sources only and forces the weekly FSAI check);
  - run history (discovered, analysed, draft sets, searches, AI calls, notices and errors).
- **`/admin?tab=users`** (the default admin landing tab) has a compact **morning summary** card at
  the top: today's counts, whether the daily job is enabled, and the top 3 prospects. It links
  to the full top 10 in the Lead Intelligence tab.
- **`/admin/lead-intelligence/[id]`** is the detail page and holds the **AI Analysis** view:
  - **Buying triggers**: each signal with points, event date and source link, the FHRS reason
    text, and a "never mention in outreach" note for hygiene and enforcement signals;
  - score breakdowns and reasoning;
  - verified facts with quotes and source links (http/https only, `nofollow`);
  - public contacts with their sources;
  - drafts with Copy, **Send now** (emails) and a `tel:` link plus **Log call** (phone opener);
  - status and notes editing;
  - analysis history.

The APIs are:

- `GET`, `POST` and `PATCH` on `/api/admin/lead-intelligence`;
- `GET /api/admin/lead-intelligence/summary`;
- `POST /api/admin/lead-intelligence/run` (manual run, or analysis of a single lead);
- `POST /api/admin/lead-intelligence/sources` (`{forceFsai?}`; free sources only);
- `GET /api/cron/lead-intelligence` and `GET /api/cron/lead-intelligence-sources`.

List filters on `GET /api/admin/lead-intelligence`: `grade` (`A+`…`D` or `pursued`), `leadScore`
(minimum), `signal` (`hiring`, `fhrs`, `fsai`, `multi_site`) and `view=buy`.

## Data model and migration

**Lead Engine v2** (`prisma/migrations/20261105060000_lead_engine_v2/migration.sql`, additive):
adds `leadScore`, `grade` and `signalSummary` to `LeadIntelligenceLead`, and four tables:
`LeadIntelligenceSignal`, `LeadIntelligenceFhrs`, `LeadIntelligenceFsaiOrder` and
`LeadIntelligenceSourceSync`. Applied to production with `psql --single-transaction` after a
fresh backup, then recorded with `prisma migrate resolve --applied`.

**Original release:**

The migration is additive only. It creates three new tables and does not touch existing ones:

- `LeadIntelligenceLead`
- `LeadIntelligenceAnalysis`
- `LeadIntelligenceRun`

The migration file is `prisma/migrations/20261102060000_lead_intelligence/migration.sql`.

**It has not been applied anywhere except a local throwaway test database.** To deploy, take a
backup and then run:

```bash
npx prisma migrate deploy
```

Until the migration is applied, the APIs return 503 with "migration has not been applied", and
the morning summary shows the same message.

> Pre-existing upstream issue (not introduced here): replaying the whole migration history on an
> empty database fails with `relation "ClockEvent" does not exist`. Production databases that
> already have the earlier migrations applied are not affected. For local testing, push the
> schema with `prisma db push` and then apply this migration's SQL.

## Tests

```bash
# Offline: scoring, evidence validation, drafts, SSRF/robots/redirect policy, Maps parsing, cron auth
npx tsx --test tests/lead-intelligence/*.test.ts

# Plus DB integration (dedupe, mutex, idempotency, lease expiry, daily caps, human-status wins, cron routes,
# FHRS import/supersede/cursor, FSAI import from a synthetic PDF, weekly gate, cross-matching, source lock).
# Local throwaway Postgres only: host must be localhost and the database name must end in _test.
# Providers are faked in-process; no network calls are made.
LI_TEST_DATABASE_URL=postgresql://USER:PASS@localhost:5432/rotahr_li_test \
  npx tsx --test tests/lead-intelligence/*.test.ts
```

## Known limitations

- **Social media.** There is no login, scraping or API access to Facebook, Instagram or LinkedIn.
  Social evidence comes only from search snippets and links on the venue's own site, so
  "recently active" is set only when a dated post is visible in that evidence. Most venues will
  show the profile link without activity.
- **Crawling.**
  - robots.txt follows RFC 9309. It is fetched once per origin (www and apex are separate),
    with up to five redirects (cross-host allowed, every hop still SSRF-checked) and the first
    500 KiB parsed. Groups for `RotahrLeadIntelligence` (any version, any case) are merged and
    used; otherwise the `*` groups. Longest match wins, Allow wins ties, `*` and `$` are
    supported, and paths are percent-encoding normalised.
  - Any 4xx except 429 (including 401, 403, 404 and 410) means robots.txt is unavailable, so
    crawling is allowed. More than five redirects is treated the same way.
  - A 5xx, 429, timeout, DNS or network failure means robots.txt is unreachable, so the site is
    skipped and no page is requested. If a redirect lands on another origin whose robots.txt is
    unreachable, that page is skipped.
  - Hosts that are IPv6-only, private or reserved are skipped.
  - Pages that need JavaScript to render produce little text.
- **Estimates.** Staff counts, locations, the decision maker and response likelihood are
  estimates, not verified data.
- **Discovery breadth.** Discovery is deliberately small: four job searches and one Maps search a
  day, within paid-call caps. Increase it through the env caps only after reviewing provider costs.
- **Job adverts** come from Google snippets via Serper only; job boards are never scraped. An
  advert without a named employer, or from an agency, is dropped.
- **FSAI parsing** depends on the PDF layout. If FSAI changes it, pages are skipped and reported,
  not misread. Most FSAI orders are retailers, which are not promoted.
- **FHRS** covers England, Wales and Northern Ireland, for the business types listed above.
- **Coverage gaps are not negatives.** An empty or failed analysis keeps the previous one and
  records `lastError`. The lead is retried after 24 hours.
