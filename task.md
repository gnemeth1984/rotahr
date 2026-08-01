# Public Venue Pages — build plan

Goal: auto-generated public page per business at rotahr.com/v/<slug>, built from data
venues already maintain (dishes, specials, hours, contact). SEO for them, SEO for us.

## Key facts established
- Dish, MenuSpecial are **businessId**-scoped (NOT venue) -> page is per Business,
  contact details pulled from the default Venue.
- Prisma client import path is `@/lib/prisma` (there is no lib/db.ts).
- Blob store is private-access only -> public image proxy needed (pattern:
  app/api/blog/cover-image/route.ts, which is already public/no-auth).
- MUST NOT LEAK: Dish.costPrice, Venue.notes, Venue.equipment, staff names,
  supplier prices, internal MenuSpecial categories ("86'd" = out of stock, internal).

## Steps
- [x] 1. Schema: public page fields on Business
- [x] 2. lib/public-page/: types, slug helper, opening hours, safe selectors
- [x] 3. app/v/[slug]/page.tsx public page + JSON-LD + noindex control
- [x] 4. app/api/public/venue-image proxy (no auth)
- [x] 5. app/api/public/booking booking request endpoint
- [x] 6. Settings UI + save API
- [x] 7. sitemap: add venue pages + FIX rotahr.vercel.app -> rotahr.com
- [x] 8. verify: typecheck, deploy, curl live

## Deploy loop
npx tsc --noEmit -p .  -> git push -> poll GitHub commit status -> curl rotahr.com

## DONE — shipped & verified live (2026-08-01)
Commits: 41068a8 (feature), b81e988 (rate-limit fix), 7dea574 (leak fix)
Live: https://rotahr.com/v/the-anchor-tap (demo, noindex ON)

Verified on production:
- 200, JSON-LD Restaurant + PostalAddress + GeoCoordinates + OpeningHoursSpecification
- canonical rotahr.com, robots noindex honoured
- leak scan clean: costPrice / supplier / businessId / internal ids / staff emails = 0
- unknown slug -> 404; disabled page -> 404
- image proxy rejects non-blob host, http://, substring-spoof, malformed = all 400
- booking: honeypot silently no-ops (0 rows), validation errors correct,
  valid request -> status "pending", createdByName "Public page", no table assigned
- sitemap: 0 rotahr.vercel.app refs, noindex venues excluded

### Bug caught during visual review (IMPORTANT)
Staff announcement was rendering publicly ("All staff must read updated allergen
sheet... See Marco for briefing"). Root cause: "announcement" was in the public
category allowlist, but that category is staff-facing in Rotahr. Fixed to
"special" only + added MenuSpecial.hideFromPublic per-item override.

## Remaining / next
- Hero image upload UI (field exists in DB + renders; no uploader in settings yet)
- Per-special "hide from public page" toggle in the Menu Specials UI (API accepts
  hideFromPublic already; no checkbox rendered yet)
- Review-request automation (next highest ROI feature — data already present)
- POS tip sync
