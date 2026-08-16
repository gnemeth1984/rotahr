/**
 * Proves the Navigator red list fails closed. Pure module, no DB, no network.
 * Run: bun run scripts/verify-redlist.ts
 */
import {
  classify,
  isRed,
  RED_CAPABILITIES,
  ACTION_CAPABILITY,
  redListPromptBlock,
  type Capability,
} from "../lib/navigator/redlist";

let pass = 0;
let fail = 0;

function ok(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}`);
  }
}

console.log("\n--- the four Gabor ticked are red ---");
for (const cap of ["haccp", "money", "destructive", "authz"] as Capability[]) {
  ok(`${cap} is red`, isRed(cap));
}

console.log("\n--- outbound is red too, though it was not ticked ---");
ok("outbound is red", isRed("outbound"));

console.log("\n--- routine is the only non-red bucket ---");
ok("routine is not red", !isRed("routine"));
ok("exactly 5 red capabilities", RED_CAPABILITIES.length === 5);

console.log("\n--- red actions never auto, even with autonomy ON ---");
const redActions = [
  "haccp.log",
  "haccp.check.complete",
  "expense.create",
  "invoice.send",
  "pricing.update",
  "subscription.change",
  "payroll.run",
  "record.delete",
  "booking.cancel",
  "user.role.change",
  "user.invite",
  "permission.update",
  "email.send",
  "sms.send",
  "campaign.send",
  "customer.message",
];
for (const a of redActions) {
  const v = classify(a, true);
  ok(`${a} blocked with autonomy ON`, v.auto === false && v.reason.length > 0);
}

console.log("\n--- unknown actions fail CLOSED ---");
for (const a of ["", "   ", "definitely.not.real", "haccp.log.bypass", "task.create.evil"]) {
  const v = classify(a, true);
  ok(`"${a}" refused and flagged unknown`, v.auto === false && v.unknown === true);
}
// @ts-expect-error deliberately wrong type at runtime
ok("non-string action refused", classify(null, true).auto === false);
// @ts-expect-error deliberately wrong type at runtime
ok("object action refused", classify({}, true).auto === false);

console.log("\n--- routine actions respect the master switch ---");
ok("task.create auto when ON", classify("task.create", true).auto === true);
ok("task.create blocked when OFF", classify("task.create", false).auto === false);
ok("plan.build blocked when OFF", classify("plan.build", false).auto === false);
ok(
  "OFF reason names the switch",
  classify("task.create", false).reason.toLowerCase().includes("setup"),
);

console.log("\n--- registry sanity ---");
const caps = Object.values(ACTION_CAPABILITY);
ok("registry is non-empty", caps.length > 0);
ok(
  "every registry entry has a known capability",
  caps.every((c) =>
    ["haccp", "money", "destructive", "authz", "outbound", "routine"].includes(c),
  ),
);
ok(
  "no red action is mislabelled routine",
  !["haccp.log", "email.send", "record.delete", "user.role.change", "invoice.send"].some(
    (a) => ACTION_CAPABILITY[a] === "routine",
  ),
);
ok(
  "every red capability appears in the prompt block",
  RED_CAPABILITIES.every((c) => redListPromptBlock().includes(RED_REASON_SNIPPET(c))),
);

function RED_REASON_SNIPPET(c: Capability): string {
  const map: Record<Capability, string> = {
    haccp: "HACCP records",
    money: "touching money",
    destructive: "Deletes and irreversible",
    authz: "Roles, permissions",
    outbound: "cannot be unsent",
    routine: "",
  };
  return map[c];
}

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
