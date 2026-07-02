# Session tasks

1. [DONE] Blog empty — cron env/config fine, manually triggered generate-blog 6x. 6 posts now live. Cron will keep adding daily.
2. [TODO] HACCP cleaning records: + and edit buttons overlapping, hard to press (mobile). Find component, fix spacing/layout.
3. [TODO] Add "On Break" button to clock page + break entitlement reminder notification:
   - After clock-in, if shift length entitles to a break (Irish law: 4.5-6hrs = 15min, 6+ hrs = 30min), remind employee to take it.
   - Track break start/end (on break button toggles).
   - Need to check current Shift/clock schema — no Break model exists yet, need to add one.

## Findings
- Clock pages: app/(app)/clock, app/api/clock
- No cleaning-specific page found yet by name "cleaning" — check haccp/page.tsx (CleaningForm inside it likely)
- No Break model in prisma schema yet.
