# Tenant-isolation sweep on [id] write routes (Aug 2026)

Gabor approved a full sweep after `f57c034` fixed `/api/reservations/[id]`.

## Helper
- [x] `lib/auth/tenant.ts` — `requireTenant({manager})`, `isResponse`, `notFound`

## Vulnerable routes to fix
- [ ] lib/services/shift.service.ts — `update(id, _businessId)` IGNORES businessId; `delete(id)` unscoped
- [ ] app/api/shifts/[id]/route.ts — DELETE fetches by raw id
- [ ] app/api/certifications/[id]/route.ts — PATCH + DELETE
- [ ] app/api/hr/documents/[id]/route.ts — DELETE
- [ ] app/api/hr/onboarding/[id]/route.ts — PATCH (no role check either) + DELETE
- [ ] app/api/timeoff/[id]/route.ts — PATCH + DELETE
- [ ] app/api/bookings/[id]/flags/[flagId]/resolve/route.ts — PATCH
- [ ] app/api/bookings/[id]/flag/route.ts — POST (arbitrary reservationId)
- [ ] app/api/venues/[id]/route.ts — PATCH + DELETE
- [ ] app/api/venues/[id]/checklists/route.ts — GET + POST
- [ ] app/api/venues/[id]/checklists/[clId]/route.ts — PATCH + DELETE
- [ ] app/api/venues/[id]/checklists/[clId]/items/route.ts — POST
- [ ] app/api/venues/[id]/checklists/[clId]/items/[itemId]/route.ts — PATCH + DELETE
- [ ] app/api/suppliers/statements/[id]/reconcile/route.ts — POST
- [ ] app/api/log-book/entries/[id]/updates/route.ts — DELETE (any update by id)
- [ ] app/api/menu/functions/[id]/courses/route.ts — PATCH + DELETE (courseId unchecked)
- [ ] app/api/menu/functions/[id]/courses/[courseId]/dishes/route.ts — POST/PATCH/DELETE

## Also fix
- [ ] Remove `businessId ?? "christys-bar-seed-id"` fallback in log-book routes
      (entries/[id], entries/[id]/updates, tasks/[id], tasks/[id]/updates)

## Verified already safe
bookings/[id], employee/[id], expenses/[id], tables/[id], stock/[id], suppliers/[id],
orders/[id], reservations/[id], crm/* , menu/dishes/[id], menu/functions/[id],
channels/*, notifications/[id]/read, app-notifications/[id]/read (updateMany+userId),
timeoff approve/reject (service scopes), admin/email/broadcasts/[id] (super-admin only)

## Notes
- Brevo is NOT used in code — only mentioned in docs/email-marketing/content.md as a
  suggested free tool. App sends via Resend (`lib/email/send.ts`). There is already an
  /admin email system: app/api/admin/email/{broadcasts,contacts,segments,sent}.
