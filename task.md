# Task: Log Book — staff reporting + manager update notes/scheduling

## Request
Staff should be able to report repair/maintenance issues themselves (not just managers),
and managers should be able to add running "update" notes to an entry — e.g. who was
called (Ben), and when the repairman/contractor is due.

## Found + fixed along the way
- BUG: /api/log-book/entries and /api/log-book/tasks used `requirePermission("logbook")`,
  which only lets MANAGER/ADMIN through by default (employees need the permission
  explicitly granted per-employee). That silently blocked staff from using a feature
  whose feature-key defaults to all roles. Switched to plain session auth (matches
  Messages/Shift Swaps pattern) for viewing + creating log entries and completing tasks.
  Task/entry deletion and task creation/assignment stay manager/admin-only (explicit role
  check), matching the existing "isManager" gate in the UI.

## Built
- Prisma: LogEntry gained `assignedToName` (free text — contractor may not be a Rotahr
  user) and `dueAt` (DateTime). New `LogEntryUpdate` model — running notes thread per
  entry (note, createdBy, createdAt). `prisma db push` ran clean.
- API: POST /api/log-book/entries/[id]/updates (manager/admin only) to add an update;
  DELETE to remove one. GET /api/log-book/entries now includes `updates` (all roles can
  read the thread, only managers can post to keep it a "manager updates" log per Gabor's
  ask).
- UI: repair-type entries in the create dialog show "who's fixing it" + due date/time
  fields. Entry cards show assigned contractor + due date, with an "Overdue" badge if
  dueAt has passed and it's still unresolved. Update thread renders under each entry;
  managers get an inline input to post a new update (Enter or button). Staff can see but
  not post updates or delete entries (delete button hidden for non-managers now).

## Verification plan
1. tsc --noEmit clean.
2. Local: verify entries/tasks GET/POST reachable by non-manager session (can't easily
   swap session role locally — spot-check via code review of role checks instead, plus
   curl 401/200 sanity).
3. Deploy, confirm rotahr.com/log-book 307 (auth redirect) and API 401 as before (no 500s).
