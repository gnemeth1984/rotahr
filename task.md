# Task: 7shifts gap-close — Manager Log Book/Tasks + per-venue Reports

## Part 1: Manager Log Book & Ops Tasks — DONE
- Prisma models: LogEntry (note/86/repair), OpsTask (assignable, photo-proof optional). Added back-relations on Business, Venue, Employee, User. `prisma db push` ran clean.
- Feature key "logbook" added to lib/features.ts (category Core, all roles can see, matches messages/shift-swaps pattern).
- API: /api/log-book/entries (GET/POST), /api/log-book/entries/[id] (PATCH/DELETE), /api/log-book/tasks (GET/POST), /api/log-book/tasks/[id] (PATCH/DELETE), /api/log-book/tasks/upload-photo (POST, Vercel Blob private, same pattern as dish-photos).
- Page: app/(app)/log-book/page.tsx — two tabs (Manager Log / Tasks), same tab pattern as menu-specials page, same Card/Dialog/Select components as training page for design consistency. Suspense-wrapped for useSearchParams per training page convention.
- Nav: added to sidebar.tsx, all roles, no plan restriction (like Messages/Shift Swaps), icon NotebookPen.

## Part 2: Per-venue breakdown on Reports page — IN PROGRESS
- Extend GET /api/reports/labor-cost to optionally break down by venue (only meaningful for Enterprise/multi-venue businesses).
- Extend /reports page: show a per-venue table (labour cost, revenue, labour%) below the existing charts, only rendered if business has >1 venue.

## Remaining steps
1. Build venue breakdown into labor-cost API + page.
2. Typecheck everything (tsc --noEmit).
3. Verify routes locally (200/307/401 as appropriate, no 500s).
4. Commit, push, confirm Vercel deploy READY, curl rotahr.com routes.
5. Design/consistency check: confirm log-book page matches existing light theme (Card/Dialog/Select/Badge, cn() utility, orange accent icon in header like other feature pages) — not the dark-navy blog-comments style (that's intentionally a separate internal tool).
