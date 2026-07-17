# Task: Offer expiry UI + site-wide update pass — DONE

## 1. Offer expiry — was already built server-side (expiresAt, default hardcoded 30d), just no UI control.
- Added a pill selector (7/14/30/90 days / No expiry) in the CRM offer generation dialog.
- Offer list now flags expired-but-unredeemed offers in red ("expired {date}").
- Redemption page already had an expired badge from before.

## 2. Updated public pages to reflect all recent work
- /pitch — "What's New" slide: added 5 new highlighted cards (Reports & Insights, Manager Log Book,
  CRM Promo Offers + QR, Send-as-yourself CRM email, Region-aware overtime compliance). Demoted old
  "New" badges on Floor Plan/Recipe Photos/HACCP schedules (no longer new). Compare table got 4 new rows.
- /compare — added rows: Manager log book, Region-aware overtime compliance, Labour cost vs revenue
  trend reports, Per-venue labour cost breakdown, CRM promo codes w/ QR, Send CRM email as yourself.
  Scored fairly against Deputy/Bizimply/7shifts/Planday/Sling based on earlier research in this
  conversation (7shifts/Planday get partial/yes credit for their own reporting; nobody else has
  QR-redeemable CRM offers or send-as-yourself CRM email).

## 3. Blog post published
- New article: "What's New in Rotahr: Reports, a Manager Log Book, and Smarter CRM Emails"
  (slug: whats-new-in-rotahr-reports-log-book-crm-emails), category "product", published: true.
  Matches house style (general/international audience, direct tone, markdown, mentions Rotahr
  naturally — though more centrally here since it's explicitly a product-update post).
  Published directly to the DB (no admin UI for this, cron only auto-generates SEO topics) —
  confirmed live via /api/blog/[slug].

## Status: code changes committed + pushed, waiting on Vercel deploy confirmation, then final live checks.
