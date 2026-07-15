# Task: Planday feature-gap analysis + close the gaps

## Research done
Planday's real feature set (via web search):
- Drag&drop scheduling + shift templates/copy-week — Rotahr HAS this (ShiftTemplate model, applyTemplate in rota page). Memory saying "TODO" was stale.
- Shift swap/handover/"sell" — Rotahr HAS open shift swap marketplace (ShiftSwapRequest, status "open"). Close enough parity.
- Time off / leave management — Rotahr HAS (TimeOffRequest + /timeoff page).
- Training/certs — Rotahr HAS (TrainingCertification + /training page). Memory TODO was stale.
- Clock in/out, break rules — Rotahr HAS (clock page, break entitlement tracking, Irish law specific — arguably deeper than Planday's generic rules).
- Team messaging — Rotahr HAS (/messages).
- **GAP 1: Reporting & Insights dashboard** — Planday has a dedicated visual reporting section: labour cost vs revenue trend over time, wage % trend, forecast accuracy. Rotahr only has a *live single-week* labour % banner on the Rota page (weeklyRevenueTarget + totalLabourCost) — no historical trend view. Building this now.
- **GAP 2: Working-time compliance warnings** — Planday flags overtime/compliance issues while building the schedule. Rotahr tracks overtimeHours per shift but doesn't warn about weekly overtime thresholds while scheduling. Building this now (rota page warning banner).
- GAP 3 (roadmap, not building now — too large / needs OAuth & partner approval): Xero/Sage accounting integration (payroll data export to external accounting). Already have BrightPay payroll export (app/api/payroll/brightpay) which covers similar ground for Irish payroll — flagged as partial coverage.
- GAP 4 (roadmap, not building now): Public/open API for third-party integrations. Low priority, high effort — no current demand signal from Gabor.

## Plan (approved implicitly — user said "make a plan...and do the changes")
1. Add `reports` feature key to lib/features.ts (Finance category, manager/admin). DONE.
2. Build /api/reports/labor-cost — aggregate last 12 weeks of Shift data (hours*rate + overtime*1.5*rate, same formula as rota page) vs PosSnapshot.totalRevenue (fallback to weeklyRevenueTarget), grouped by ISO week.
3. Build /reports page — recharts line/area chart: labour cost vs revenue, labour % trend with threshold line, overtime hours trend. Summary cards (avg labour %, total labour cost, total OT hours).
4. Add nav item in components/shared/sidebar.tsx (Pro & Enterprise plans, Manager/Admin roles, icon e.g. TrendingUp).
5. Add overtime compliance warning to rota page: flag employees scheduled beyond a weekly threshold (48h EU working time directive default, configurable later) directly in the rota UI where labour cost banner already lives.
6. Typecheck, verify locally, commit, push, confirm Vercel deploy, verify rotahr.com/reports.

## Status: in progress — building API + page now.
