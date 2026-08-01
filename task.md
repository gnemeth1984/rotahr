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
