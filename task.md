# Rotahr Feature Batch — June 2026

## Features
1. Irish public holiday detection on rota
2. Shift templates & copy-week-to-week
3. Multi-venue support (Business → Venue model)
4. Late/no-show auto-alerts (cron + notification)
5. Training & certifications tracker (HACCP, bar certs, expiry alerts)

## Plan

### 1. Irish Public Holidays
- Static list of Irish bank holidays (calculated annually: New Year, St Patrick's, Easter Mon, May/June/Aug bank holidays, Oct bank holiday, Christmas, St Stephen's Day)
- Utility fn: `getIrishPublicHolidays(year): { date: string; name: string }[]`
- Rota page: highlight PH days in the grid, show badge, flag shifts on PH days with premium pay indicator
- No schema change needed

### 2. Shift Templates & Copy Week
- Schema: `ShiftTemplate` already exists — check fields
- New: `POST /api/shifts/copy-week` — copy all shifts from weekA to weekB (unassigned or keep employee)
- New: `POST /api/shifts/templates/apply` — apply a named template to a week
- Template save: `POST /api/shifts/templates` — save current week as template
- Rota page: "Copy from last week" button + "Save as template" + "Apply template" dropdown

### 3. Multi-Venue Support
- Schema: add `Venue` model linked to `Business` (name, address, geoLat, geoLng, geoRadius, timezone)
- Move geo fields from Business to Venue
- Employee gets optional `venueId`
- Shift gets optional `venueId`  
- Add venue switcher to sidebar/header for managers
- Admin can manage venues at /settings/venues
- Session carries venueId filter

### 4. Late/No-Show Auto-Alerts
- Cron: `/api/cron/late-checkin` — runs every 15min (or use Vercel cron every hour)
- Logic: find shifts starting >15min ago where employee has no clock-in → create AppNotification + send push
- Add to vercel.json cron schedule

### 5. Training & Certifications
- Schema: `TrainingCertification` model: id, employeeId, title, issuer, issuedDate, expiryDate, category (HACCP/ALCOHOL/MANUAL_HANDLING/FIRST_AID/OTHER), documentUrl, status (VALID/EXPIRING_SOON/EXPIRED)
- API: CRUD at `/api/certifications`
- Page: `/training` — table per employee, expiry badges, filter by category/status
- Cron: `/api/cron/cert-expiry` — daily, flag certs expiring within 30 days → AppNotification to manager
- Sidebar: add Training entry (managers/admins)

## Execution Order
1. Prisma schema changes → db push
2. Irish PH utility (no schema)
3. Shift templates & copy-week APIs + rota UI
4. Multi-venue schema + API + UI
5. Late/no-show cron
6. Training certs schema + API + page
7. Sidebar updates
8. Build check
