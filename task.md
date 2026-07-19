# Task: Build (1) Guest Preferences surfacing + (2) WhatsApp/SMS messaging (gated until configured)

## Part 1: Guest Preferences (seatingPreference + surface allergies on Floor Plan/Bookings)
Note: dietaryNotes/allergies ALREADY existed on Customer model + CRM UI. Adding seatingPreference is new.
Real gap being closed: allergy/dietary info stored on Customer profile was NOT surfaced automatically on
Floor Plan / Bookings list when a reservation is linked to that customer — staff had to separately open CRM.

- [x] Add `seatingPreference String?` to Customer model, `prisma db push` (clean, additive)
- [x] app/api/crm/customers/[id]/route.ts — add seatingPreference to updateSchema, PATCH updateData, and both anonymise blocks
- [ ] app/api/crm/customers/route.ts (list/create) — add seatingPreference to create schema + create data
- [ ] app/(app)/crm/[id]/page.tsx — add seatingPreference to interface, view, edit form
- [ ] app/(app)/crm/page.tsx — add seatingPreference to create form (optional, lower priority)
- [ ] app/api/tables/list/route.ts — when attaching dayReservations, also join Reservation.customerId -> Customer
      to include hasAllergy/hasDietary/allergies/dietaryNotes/seatingPreference on each DayReservation
- [ ] components/bookings/FloorPlanView.tsx — extend DayReservation type, render an allergy/alert badge (red icon)
      on table when any seated/upcoming reservation has allergies set; tooltip shows the actual text
- [ ] app/(app)/bookings/page.tsx — when linking a booking to an existing customer (by phone/email match),
      auto-prefill the dietary textarea from customer.allergies/dietaryNotes if booking's own dietary field is empty
- [ ] typecheck, deploy, verify

## Part 2: WhatsApp/SMS guest messaging (build fully, but GATE behind config — do not surface UI until real Twilio/Meta creds present and verified working)
- [ ] Prisma models: `GuestMessage` (log), maybe `MessagingSettings` per business (phone number, WhatsApp opt-in status)
- [ ] Add `smsWhatsappConsent Boolean @default(false)` to Customer (separate from gdprConsent — explicit consent for guest messaging, PECR/GDPR requirement)
- [ ] lib/messaging/twilio.ts — wrapper for send SMS + send WhatsApp template message
- [ ] lib/messaging/config.ts — `isMessagingConfigured()` helper: true only if TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_NUMBER (or SMS number) all present AND a live test succeeds — gate everything behind this
- [ ] API: POST /api/messaging/send (send to a customer, respects consent + gating), webhook receiver for inbound + delivery status
- [ ] UI: "Send WhatsApp/SMS" button on CRM profile — ONLY rendered if a server-side config-check endpoint returns configured:true. Until Gabor provides real Twilio/Meta WhatsApp Business credentials and it's confirmed sending real messages, this entry point must stay invisible (no half-working button shown to end users) — per explicit instruction.
- [ ] ask_secrets for TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_NUMBER when ready to activate (not blocking the build itself)
- [ ] typecheck, deploy, verify gating works (confirm UI stays hidden with no creds set)

## Workflow reminder (established pattern this session)
edit -> npx prisma db push (if schema changed) -> npx tsc --noEmit -p . -> git add -A && commit && push origin main
-> poll Vercel gnemeth1984-rotahr deployments until READY -> curl rotahr.com to confirm no 500s
