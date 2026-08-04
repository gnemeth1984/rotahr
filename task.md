# "Get better" pass — Aug 4 2026

Audit baseline after PSI key: rotahr.com 98/100. Lighthouse a11y 85, best-practices 92.

## Done
- [x] CSP: allow app.lemonsqueezy.com + assets.lemonsqueezy.com in script-src, connect-src, frame-src
      (lemon.js was BLOCKED in prod — overlay checkout dead)
- [x] viewport: removed maximumScale:1 (was failing meta-viewport a11y audit, blocked pinch-zoom)
- [x] contrast: landing slate-400 -> slate-600 on light bgs; badge/price #F97316 -> #C2410C;
      text-red-500 -> red-700; orange link -> orange-700 + permanent underline
      (left slate-400 inside dark CTA + dark /compare pages alone — passes there)
- [x] landmark-one-main: <main> added to /landing, /blog, /blog/[slug]
- [x] privacy/terms "Last updated" slate-400 -> slate-600

## In progress
- [ ] Verify whether checkout CTA depends on lemon.js (dead buttons?) or plain hrefs
- [ ] Content volume gap: 7shifts 1008 sitemap URLs vs our 79
      NOTE: lib/seo/locations.ts warns against doorway pages — do NOT mass-generate city pages.
      Plan: real /features/[slug] module pages (HACCP, rota, bookings, payroll, bookkeeping, CRM)
      + expand landing (574w) with an answer-shaped FAQ
- [ ] publicClaimToken for Christy's Bar "The Well" (cmsap83160000vavrlksnx272)
- [ ] tsc + build, commit, push, re-audit

## Blocked on Gabor
- PAGESPEED_API_KEY must be added to Vercel env vars (only in local .env.local)
- Search Console: add service account as Full user (403)
- PrivateEmail mailbox + SPF/DKIM
