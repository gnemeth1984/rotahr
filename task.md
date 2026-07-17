# Task: Block real emails from demo accounts — DONE

## What changed
- lib/demo/reset.ts: added `isDemoBusinessId(businessId)` (checks "demo-" prefix, matches every
  seed-demo.ts business id: demo-anchor-tap-biz, demo-owner-starter-biz, demo-owner-pro-biz,
  demo-owner-ent-biz, etc.) alongside the existing `isDemoEmail(email)` (@rotahr.demo suffix).
- app/api/crm/customers/[id]/email/route.ts: if either check is true, the route now skips
  sendViaGmail AND resend.emails.send entirely — no outbound network call happens at all. It still
  creates the CrmEmail log row (so the UI/email history looks and behaves identically) and returns
  `simulated: true` instead of pretending a real send happened.
- CRM page: shows "Demo mode — this will be logged in the email history but no real email is sent."
  in the compose dialog before sending (client-side check on session.user.email), and an explicit
  alert after "sending" confirming nothing real went out.
- Real business accounts (e.g. admin-test-biz, or any paying customer) are unaffected — businessId
  doesn't start with "demo-" and email doesn't end in "@rotahr.demo", so sending behaves exactly as
  before (Gmail if connected, else Resend fallback).

## Why this specific fix
CRM "Send Email" was the only place in the app that calls Resend/Gmail directly with a
user-controlled recipient (customer.email) — a demo visitor could type in *any* real address
(their own, curiosity, whatever) and it would have gone out for real, including with the new
Promo Offers/QR flow. Checked bookings/reservations too — no email-sending code there, so no
other paths needed the same guard.

## Verified
- tsc --noEmit clean.
- Confirmed via code review that isDemoBusinessId won't false-positive on Gabor's real
  "admin-test-biz" account (doesn't start with "demo-") — his own real Gmail-connected sending
  (tested working in earlier turns) is untouched.
- Live browser click-through wasn't done this pass (kept scope to a quick, well-scoped safety fix) —
  relying on the same guard pattern already proven correct in the isDemoEmail original code.
