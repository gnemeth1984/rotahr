# CRM Build

## Data sources
- Reservations (auto-build customer profile from name+email+phone)
- POS snapshots (revenue enrichment if connected)

## Schema — new model: Customer
- id, businessId
- name, email, phone
- birthday (Date?)
- dietaryNotes (String?)
- allergies (String?)
- tags (String[]) — VIP, Regular, Allergy, etc
- internalNotes (String?)
- gdprConsent (Boolean) — required for marketing emails
- gdprConsentAt (DateTime?)
- isAnonymised (Boolean) — soft GDPR erasure
- createdAt, updatedAt

## Derived / computed (from relations)
- totalVisits — count of reservations
- noShows — count of no-show reservations
- lastVisit — most recent reservation date
- totalSpend — from POS if connected (can't reliably get from reservations alone)
- avgSpend — totalSpend / totalVisits

## Relations
- Customer -> Reservation[] (one customer, many reservations)
- Customer -> CrmNote[] (manager notes with timestamp + author)
- Customer -> CrmEmail[] (log of emails sent via Rotahr)

## New models needed
- CrmNote: id, customerId, authorId (User), note, createdAt
- CrmEmail: id, customerId, subject, preview, sentAt, sentById

## Migration plan
- Add Customer model
- Add CrmNote, CrmEmail models
- Add customerId (optional) to Reservation — link existing reservations by email match
- Run migration script to backfill: group existing reservations by email → create Customer rows

## API routes
- GET  /api/crm/customers         — paginated list, search, filter by tag
- GET  /api/crm/customers/[id]    — full profile + reservations + notes + emails
- POST /api/crm/customers         — manual create
- PATCH /api/crm/customers/[id]   — update profile, tags, notes, birthday etc
- DELETE /api/crm/customers/[id]  — GDPR erasure (anonymise, don't hard delete)
- POST /api/crm/customers/[id]/notes    — add note
- POST /api/crm/customers/[id]/email   — send email + log it
- GET  /api/crm/customers/export  — CSV download
- POST /api/crm/customers/merge   — merge two duplicate profiles

## Pages
- /crm — customer list (search, filter, sort, tags)
- /crm/[id] — customer profile page

## Sidebar
- Add CRM to main nav (managers/admins only)

## GDPR
- gdprConsent required before any marketing email
- Anonymise on erasure request (name→"Deleted", email→null, phone→null)
- Data minimisation notice on profile page

## Status
- [ ] Schema + migration
- [ ] Backfill script
- [ ] API routes
- [ ] CRM list page
- [ ] CRM profile page
- [ ] Sidebar nav
- [ ] Commit + push
