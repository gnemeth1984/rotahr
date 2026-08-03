# Current thread

## Fixed this turn
- Vercel build was FAILING (that's why /demo/preparing + /api/demo/status 404'd for hours):
  `useSearchParams()` not wrapped in Suspense on /demo/preparing. Fixed in 6ccbe25 — page.tsx is now a
  server wrapper with Suspense + force-dynamic, client moved to DemoPreparingClient.tsx. Deployed, both routes 200.

## New bug found on prod
Demo reset was started un-awaited inside the NextAuth credentials callback. On Vercel the function is
frozen once the response is sent, so the ~127s seed gets killed partway → half-wiped demo dashboard
(prod showed "Shifts Today 2" instead of 10) and `release()` never runs so DemoResetState stays
`running:true` until STUCK_MS.

Fix in progress:
- auth callback no longer runs the seed
- demo login always routes to /demo/preparing
- interstitial POSTs /api/demo/prepare, which claims the slot and AWAITS seedDemo (maxDuration 300)
- interstitial still polls /api/demo/status so a second visitor waits on someone else's run

Open risk: if the Vercel plan is Hobby, maxDuration caps at 60s and the seed dies again.
Test on prod by timing POST /api/demo/prepare. If capped, chunk the seed into stages.

## Still to do
- Screenshot /tmp/email-preview.html (5 outreach emails) — never visually checked
- Tell Gabor: Railway email service is GONE (404 on every route), 1,625 leads stalled, server.js 087df4f
  can't deploy until he redeploys. Ask whether to move the sender into the main Next app.
- Deliver directory-listings.md + screenshots/ + logo-square-512.png + rotahr-brochure.pdf
- Env vars Gabor must set by hand (Vercel token dead): CRON_SECRET, 3 VAPID keys, POS keys, UNSUBSCRIBE_SECRET
