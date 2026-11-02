# Lead Intelligence

A daily, super-admin-only research assistant that finds Irish and UK hospitality venues, analyses
public evidence about them, scores them, and prepares **draft** outreach for a human to review.

It never contacts anyone. No email is sent and no call is placed. Records are never copied into
`OutreachLead` or handed to the automated outreach sender.

## What runs, and when

`GET /api/cron/lead-intelligence` is scheduled in `vercel.json` as `0 6 * * *`.

- Vercel cron runs in **UTC**, so this is 06:00 UTC: 07:00 in Ireland/UK during summer time and
  06:00 in winter. Vercel crons cannot follow DST. For a fixed 06:00 local time all year, change
  the schedule twice a year (`0 5 * * *` in summer) or call the route from a scheduler that is
  aware of timezones.
- The route requires `Authorization: Bearer $CRON_SECRET`, compared in constant time. If
  `CRON_SECRET` is missing, every request is refused.
- If `LEAD_INTELLIGENCE_ENABLED` is not `true`, the route returns `{skipped:true}` and makes no
  calls. If either provider key is missing, it returns 503 and starts no run.

Each run has these steps:

1. **Discover.** Discovery uses Serper Maps (one Irish and one UK city per day, rotating) and two
   Serper web searches (directories and job/new-opening listings). One `gpt-4o-mini` call pulls
   named venues out of the search snippets.
   - A Maps result is kept only if its address can be shown to be in the requested country
     (Eircode, county, `BT` or UK postcode, or a country name).
   - Seeds are also read, **read-only**, from the existing `CallLead`, `VenueCandidate` and
     `OutreachLead` tables. Email addresses from those tables are not reused as evidence.
2. **Save.** New venues are written to `LeadIntelligenceLead`, with deduplication (see below).
3. **Analyse.** The queue holds leads due for analysis, never-analysed first, up to 5 per run.
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

## Scoring

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
written from validated facts only. They are drafts with copy buttons. **There is no send action.**

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
| `CRON_SECRET` | yes | Bearer token Vercel sends to cron routes. Already used by the existing crons. |
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
  - a table sorted by priority and filterable by search, country, county, classification,
    minimum fit, intent and priority, intent status, and contacted;
  - "Add business" and "Run now" buttons;
  - run history (discovered, analysed, draft sets, searches, AI calls, notices and errors).
- **`/admin?tab=users`** (the default admin landing tab) has a compact **morning summary** card at
  the top: today's counts, whether the daily job is enabled, and the top 3 prospects. It links
  to the full top 10 in the Lead Intelligence tab.
- **`/admin/lead-intelligence/[id]`** is the detail page and holds the **AI Analysis** view:
  - score breakdowns and reasoning;
  - verified facts with quotes and source links (http/https only, `nofollow`);
  - public contacts with their sources;
  - drafts with copy buttons;
  - status and notes editing;
  - analysis history.

The APIs are:

- `GET`, `POST` and `PATCH` on `/api/admin/lead-intelligence`;
- `GET /api/admin/lead-intelligence/summary`;
- `POST /api/admin/lead-intelligence/run` (manual run, or analysis of a single lead);
- `GET /api/cron/lead-intelligence`.

## Data model and migration

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

# Plus DB integration (dedupe, mutex, idempotency, lease expiry, daily caps, human-status wins, cron route).
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
- **Discovery breadth.** Discovery is deliberately small: two cities a day, within paid-call caps.
  Increase it through the env caps only after reviewing provider costs.
- **Coverage gaps are not negatives.** An empty or failed analysis keeps the previous one and
  records `lastError`. The lead is retried after 24 hours.
