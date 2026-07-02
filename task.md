# HACCP Schedule + Notifications

## Plan
1. Add `HACCPSchedule` model (businessId, checkType, times: string[] "HH:mm" in venue local time, daysOfWeek: int[] 0-6 empty=all days, active, reminderRepeatMins)
2. `prisma db push` (NOT migrate dev - shadow db fails)
3. API: /api/haccp/schedules (GET/POST/PATCH/DELETE) - managers/admins only
4. UI: Schedule settings modal on HACCP page - per check type, add/remove times, toggle active
5. Cron: /api/cron/haccp-reminder runs every 15 min
   - Find schedules where a scheduled time has passed in last window and not yet done today (no HACCPRecord for checkType today after that scheduled time)
   - Recipients = whoever is clocked in right now (ClockEvent type=in, no matching out) OR published shift covering now (fallback if nobody clocked in)
   - Notify via createNotification + push
   - Keep reminding every 15 min (cron interval) until logged - dedupe only within same run, not across runs (per requirement: "just keep reminding")
6. Register cron in vercel.json
7. Verify build + deploy

## Status
- [ ] Schema
- [ ] API routes
- [ ] UI
- [ ] Cron
- [ ] Build + deploy
