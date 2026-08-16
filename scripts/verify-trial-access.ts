/**
 * Access-gate tests. Pure module, no DB.
 *
 * The bias under test is that this thing fails OPEN. Most of these cases exist
 * to prove we do NOT lock someone out, because that is the failure mode that
 * costs a real venue real money.
 *
 *   bun run scripts/verify-trial-access.ts
 */
import {
  computeAccess,
  isAlwaysWritable,
  isWriteMethod,
  newTrialEndsAt,
  TRIAL_DAYS,
} from "../lib/billing/access";

const now = new Date("2026-08-16T12:00:00Z");
const days = (n: number) =>
  new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

let pass = 0;
let fail = 0;

function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}\n        want ${JSON.stringify(want)}\n        got  ${JSON.stringify(got)}`);
  }
}

console.log("\n--- fail-open cases (must never be read-only) ---");

check(
  "no deadline recorded (every pre-existing business)",
  computeAccess({ lsStatus: "none", trialEndsAt: null, now }).mode,
  "full",
);
check(
  "undefined claims entirely (empty/stale token)",
  computeAccess({ now }).mode,
  "full",
);
check(
  "empty string date",
  computeAccess({ trialEndsAt: "", now }).mode,
  "full",
);
check(
  "garbage date string",
  computeAccess({ lsStatus: "none", trialEndsAt: "not-a-date", now }).mode,
  "full",
);
check(
  "paying, even with a long-expired trial date left behind",
  computeAccess({ lsStatus: "active", trialEndsAt: days(-400), now }).mode,
  "full",
);
check(
  "lemon squeezy on_trial status counts as paying",
  computeAccess({ lsStatus: "on_trial", trialEndsAt: days(-5), now }).mode,
  "full",
);
check(
  "trial with one hour left is still full access",
  computeAccess({
    lsStatus: "none",
    trialEndsAt: new Date(now.getTime() + 3600_000),
    now,
  }).mode,
  "full",
);

console.log("\n--- the one path to read-only ---");

check(
  "expired trial, never subscribed",
  computeAccess({ lsStatus: "none", trialEndsAt: days(-1), now }),
  {
    mode: "readonly",
    reason: "trial_expired",
    daysLeft: 0,
    trialEndsAt: days(-1),
    warn: true,
  },
);
check(
  "cancelled subscription past its end date reads as lapsed",
  computeAccess({ lsStatus: "cancelled", trialEndsAt: days(-2), now }).reason,
  "subscription_lapsed",
);
check(
  "past_due past its end date reads as lapsed",
  computeAccess({ lsStatus: "past_due", trialEndsAt: days(-2), now }).reason,
  "subscription_lapsed",
);

console.log("\n--- countdown / banner ---");

check(
  "23 days left does not warn",
  computeAccess({ trialEndsAt: days(23), now }).warn,
  false,
);
check(
  "7 days left warns",
  computeAccess({ trialEndsAt: days(7), now }).warn,
  true,
);
check(
  "days left rounds up so a part-day still shows as a day",
  computeAccess({
    trialEndsAt: new Date(now.getTime() + 1.2 * 86400_000),
    now,
  }).daysLeft,
  2,
);
check(
  `new trial is ${TRIAL_DAYS} days`,
  Math.round((newTrialEndsAt(now).getTime() - now.getTime()) / 86400_000),
  TRIAL_DAYS,
);

console.log("\n--- method gate (reads must always pass) ---");

for (const m of ["GET", "HEAD", "OPTIONS"]) {
  check(`${m} is not a write`, isWriteMethod(m), false);
}
for (const m of ["POST", "PUT", "PATCH", "DELETE", "post"]) {
  check(`${m} is a write`, isWriteMethod(m), true);
}

console.log("\n--- always-writable allowlist ---");

const mustPass = [
  "/api/clock",
  "/api/billing/subscription",
  "/api/auth/session",
  "/api/webhooks/lemonsqueezy",
  "/api/cron/navigator-nudge",
  "/api/help",
  "/api/notifications/read",
  "/api/push-subscription",
  "/api/unsubscribe",
];
for (const p of mustPass) {
  check(`${p} stays writable`, isAlwaysWritable(p), true);
}

const mustBlock = [
  "/api/shifts",
  "/api/bookings",
  "/api/expenses",
  "/api/haccp/temperature",
  "/api/stock",
  "/api/crm/customers",
  "/api/employees",
];
for (const p of mustBlock) {
  check(`${p} is gated`, isAlwaysWritable(p), false);
}

check(
  "prefix match cannot be fooled by a lookalike path",
  isAlwaysWritable("/api/clockwork-sabotage"),
  false,
);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
