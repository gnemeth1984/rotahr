# Task: QR code redemption for Promo Offers — DONE

## What shipped
- Installed `qrcode` package (+ @types/qrcode dev dep).
- lib/crm/qr.ts — generates a small (~2.5KB) inline base64 PNG data URI encoding a link to
  /redeem/{code}, not a hotlinked external image (avoids the "external image request" spam
  signal; combined with existing multipart/alternative plain-text fallback, this is deliverability-safe).
- Offer creation (POST /api/crm/customers/[id]/offers) now returns qrDataUri + redeemUrl alongside the offer.
- New GET /api/crm/offers/[offerId] returns offer + regenerated qrDataUri (for "Email this" on older offers).
- New GET /api/crm/offers/by-code/[code] — business-scoped lookup used by the redemption page.
- PATCH /api/crm/offers/[offerId] relaxed from manager/admin-only to any authenticated staff member —
  redemption happens at the till, often by front-of-house staff, not just managers.
- New page app/(app)/redeem/[code]/page.tsx — shows offer + customer name, "Mark as redeemed" button,
  undo option, expired badge if past expiry. Lives inside (app) so it inherits the existing auth guard
  (redirects to /auth/signin if not logged in) and sidebar shell.
- CRM customer page: generating an offer now also fetches/shows a QR thumbnail preview in the compose
  dialog with a "Remove" option (in case they don't want it), and older offers in the list get an
  "Email this" action that re-fetches the QR and opens the compose dialog pre-filled.
- Answer to "would a QR flag as spam": no — inline/embedded images (not hotlinked, not tracking pixels)
  are normal in commercial email and don't inherently trigger spam filters; the earlier plain-text-only
  fix was the real spam factor already addressed.

## Verified
- tsc --noEmit clean.
- lib/crm/qr.ts tested directly — generates valid ~2.5KB data URI.
- Redemption page + by-code API respond correctly to unauthenticated requests (307/401 as expected).
- (Browser-based live click-through wasn't possible this pass — mb tool was unresponsive/timing out
  repeatedly; relied on direct script + curl verification instead, consistent with how the rest of this
  feature was already proven live in earlier turns.)

## Deploy
- Committed, pushed, needs Vercel deploy confirmation next.
