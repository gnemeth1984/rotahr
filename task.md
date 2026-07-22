# Task: Task Organization + Messaging overhaul (6-item plan, build all)

Plan approved by Gabor. Build in priority order, deploy incrementally where safe, full verify at end.

## Items
1. [ ] Message → Task in one tap (convert a message into an OpsTask)
2. [ ] Auto-assign recurring tasks to whoever's clocked-in/on published shift for a role/department, not a fixed named person
3. [ ] Task comments/activity thread (like LogEntryUpdate, but for OpsTask)
4. [ ] Persistent department channels (replace one-off group broadcast picker)
5. [ ] Urgency levels + read confirmation for broadcast/channel messages
6. [ ] Unified "Today" view (unread messages + open tasks + unresolved log items in one feed)

## Workflow
edit -> npx prisma db push (if schema changed, safe additive only) -> npx tsc --noEmit -p . -> commit -> push origin main
-> poll Vercel gnemeth1984-rotahr deployments until READY -> curl rotahr.com key pages to confirm no 500s

## Progress Log
- [x] Schema pushed clean (additive)
- [x] staffing.service.ts helper built
- [ ] Remaining API + UI work in progress

## Notes
- Existing models: Message (1:1, senderId/recipientId, Employee-based), OpsTask (assignedToId single Employee,
  frequency once/daily/weekly, requirePhoto), LogEntry/LogEntryUpdate (comment pattern to copy for tasks),
  Department (exists, used for employee grouping already).
- Employee.userId now reliably linked (fixed earlier this session) — notifications can use it.
- appNotification.service.ts / notification.service.ts already exist and work — reuse for task/message notifications.
