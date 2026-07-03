# Admin Activity Panel — Full Build

## Plan
1. Schema changes:
   - PageView: add userId (nullable), businessId (nullable) — captured when logged in
   - User: add lastLoginAt, loginCount
   - New ActivityLog model: businessId, userId, userName, action, details(Json), createdAt
2. `prisma db push`
3. lib/services/activity.service.ts — logActivity() helper (fire-and-forget, never throws)
4. Track login: in authOptions jwt callback, update lastLoginAt/loginCount + logActivity("login") once per session start (use a flag via `user` param which only exists on initial sign-in call)
5. Instrument key actions with logActivity: booking created, expense created/added, shift published (publish-week), clock in
6. Update /api/track to accept + store userId/businessId (session-based, not client-trusted) — look up session server-side
7. Move PageTracker to root layout (app/layout.tsx) so it fires on EVERY page, not just /landing. Remove from landing page duplicate.
8. New /api/admin/activity route:
   - onlineNow: distinct sessionId/userId with pageview in last 5 min
   - liveFeed: merged recent PageViews + ActivityLog, most recent first, paginated
   - byBusiness: group by businessId
   - loginHistory: users with lastLoginAt/loginCount, sortable
9. New "Activity" tab in admin page — online now widget, live feed table (auto-refresh 15s), per-business filter, login history table
10. Build, verify, commit, push, deploy

## Status
- [ ] Schema
- [ ] Activity service
- [ ] Login tracking
- [ ] Action instrumentation
- [ ] Track route update
- [ ] PageTracker global
- [ ] Admin API
- [ ] Admin UI
- [ ] Build + deploy
