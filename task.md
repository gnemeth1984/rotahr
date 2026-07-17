# Task: CRM email improvements + Promo Offers tool

## Done
1. Gmail send now uses business name in From header: `"Business Name" <email>` (lib/google/gmail.ts).
2. Auto-signature footer (business name + default venue phone/email/address) appended to every CRM email body, in app/api/crm/customers/[id]/email/route.ts — works for both Gmail send and Resend fallback.
3. Plain-text alternative already added previously (multipart/alternative) — spam fix.
4. PromoOffer model + relations added, prisma db push done.
5. lib/crm/offer-presets.ts — 5 presets (birthday, winback, vip, welcome, custom) each with title/description template + a "why" explanation string for the UI.
6. API: POST/GET /api/crm/customers/[id]/offers (create/list), PATCH/DELETE /api/crm/offers/[offerId] (toggle redeemed / delete).

## Remaining
1. CRM customer detail page UI: add "Offers" section — preset picker (5 cards showing label + why), "Generate code" button, list of generated offers with code/redeemed toggle/delete, and an "Insert into email" action that pre-fills the compose modal with the offer's title/description + code.
2. Settings > Email page: add "why connect" + spam-folder heads up info copy (partially there already — enhance).
3. CRM page/customer list or detail: add an info callout explaining why emailing customers via CRM is valuable, with the offer ideas as concrete examples (reuse the "why" text from offer-presets.ts).
4. Typecheck, verify routes locally, deploy.

## Design notes
- Redemption is manual (staff/manager toggles "Redeemed" when someone uses the code at the till) — no POS integration hook for automatic redemption, out of scope for this pass.
- Codes are per-customer, human-typeable format e.g. "SARAH-BDAY-7F3K".
