# Rotahr Feature Build — 8 Features

## Schema additions needed
- Message model (staff messaging)
- ClockEvent model (clock in/out)
- AvailabilityPreference model (staff availability)
- RepeatTemplate model (repeating shifts)
- Employee: hourlyRate field (payroll)
- Business: onboardingComplete field (onboarding wizard)
- Shift: isRepeat, templateId fields

## Build order (parallel where possible)

### Batch 1 — Schema + DB
- [ ] Update prisma/schema.prisma with all new models
- [ ] npx prisma db push

### Batch 2 — API routes (all parallel)
- [ ] /api/messages/* (list, send, unread count)
- [ ] /api/clock/* (clock-in, clock-out, status, history)
- [ ] /api/payroll/summary route
- [ ] /api/availability/* (get, set)
- [ ] /api/shifts/repeat/* (create template, publish week)
- [ ] /api/email/shift-reminder (Resend)
- [ ] /api/onboarding/* (status, complete steps)

### Batch 3 — Pages/UI (all parallel)
- [ ] app/(app)/messages/page.tsx
- [ ] app/(app)/clock/page.tsx
- [ ] app/(app)/payroll/page.tsx
- [ ] app/(app)/availability/page.tsx
- [ ] app/(app)/onboarding/page.tsx (wizard)
- [ ] Update rota page — repeating shifts UI
- [ ] Update sidebar — new nav items

### Batch 4 — PWA
- [ ] public/manifest.json
- [ ] app/layout.tsx — add manifest + theme-color meta
- [ ] public/icons (192, 512)

### Batch 5 — Email reminders
- [ ] lib/email/shift-reminder.ts (Resend template)
- [ ] app/api/email/shift-reminder/route.ts
- [ ] Vercel cron job: vercel.json

## Status: IN PROGRESS
