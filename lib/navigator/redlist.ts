/**
 * NAVIGATOR RED LIST — the actions Navigator may never take on its own.
 *
 * Approved by Gabor on 2026-08-16. This file is the single source of truth.
 * Phase 2 (autonomous actions) must route every action through `classify()`
 * before it runs. Nothing else in the codebase may keep its own copy of this
 * list, and no action may opt itself out.
 *
 * ---------------------------------------------------------------------------
 * THIS MODULE FAILS CLOSED. Deliberately the opposite of lib/billing/access.ts.
 *
 * The trial gate fails OPEN because the cost of a wrong "no" is a chef who
 * can't record a fridge temperature during an inspection. Here the cost of a
 * wrong "yes" is Navigator emailing a real customer, deleting a record, or
 * touching money without a human ever seeing it. So:
 *
 *   - An action that is not in the registry below is NOT auto-runnable.
 *   - An action whose capability cannot be determined is NOT auto-runnable.
 *   - Anything that throws while being classified is NOT auto-runnable.
 *
 * The worst case is Navigator asking permission it didn't strictly need. That
 * is an acceptable failure. The other direction is not.
 * ---------------------------------------------------------------------------
 *
 * WHAT "RED" MEANS: never autonomous. It does NOT mean forbidden. A red action
 * can still be proposed, drafted, and executed — a human just has to tap it
 * first, every single time. There is no "remember this choice", no bulk
 * approve, and no config flag that upgrades red to auto. If a red action ever
 * needs to become automatic, it needs a new conversation with Gabor and an
 * edit to this file, not a setting.
 *
 * Pure and dependency-free so it runs anywhere and is trivially testable.
 */

/** The five capability buckets every Navigator action falls into. */
export type Capability =
  | "haccp"        // food-safety records
  | "money"        // invoices, payouts, pricing, subscriptions, payroll
  | "destructive"  // deleting or irreversibly overwriting records
  | "authz"        // roles, permissions, auth, account access
  | "outbound"     // messages that leave the building to real people
  | "routine";     // everything else: Navigator's own notes, plans, drafts

/**
 * The red list itself.
 *
 * `outbound` was not ticked on the approval form, but it is red here anyway.
 * Sending a real email or SMS to a real customer or lead cannot be undone —
 * you cannot unsend it, and it lands under Gabor's name and Rotahr's domain.
 * Treating it as amber because a checkbox was left blank would be reading the
 * form more carefully than the risk. If Gabor wants it downgraded he can say
 * so explicitly and this line changes.
 */
export const RED_CAPABILITIES: readonly Capability[] = [
  "haccp",
  "money",
  "destructive",
  "authz",
  "outbound",
] as const;

/** Plain-English reason per capability, shown in the confirm prompt and audit log. */
export const RED_REASON: Record<Capability, string> = {
  haccp:
    "HACCP records are a legal document. Only a human who actually checked the thing may log it.",
  money:
    "Anything touching money — invoices, payouts, pricing, subscriptions, payroll — needs a human.",
  destructive:
    "Deletes and irreversible overwrites need a human, because there is no undo good enough.",
  authz:
    "Roles, permissions and auth decide who can do what. Navigator does not get to change that.",
  outbound:
    "Messages to real customers or leads cannot be unsent, and they go out under Gabor's name.",
  routine: "",
};

export function isRed(cap: Capability): boolean {
  return (RED_CAPABILITIES as readonly string[]).includes(cap);
}

/**
 * Action registry. Every autonomous-capable Navigator action must be listed
 * here with its capability. Anything absent is treated as red (fail closed).
 *
 * Only `routine` entries can ever run unattended, and even then only when
 * NavProfile.autonomyEnabled is true.
 */
export const ACTION_CAPABILITY: Record<string, Capability> = {
  // --- Navigator's own workspace. Private, reversible, affects nobody else. ---
  "task.create": "routine",
  "task.update": "routine",
  "task.complete": "routine",
  "task.snooze": "routine",
  "plan.build": "routine",
  "plan.reshuffle": "routine",
  "note.write": "routine",
  "idea.draft": "routine",
  "habit.log": "routine",
  "checkin.log": "routine",
  "focus.start": "routine",
  "grocery.add": "routine",
  "meal.plan": "routine",

  // --- Red. Listed explicitly so the reason is attached and auditable. ---
  "haccp.log": "haccp",
  "haccp.check.complete": "haccp",
  "expense.create": "money",
  "expense.update": "money",
  "invoice.send": "money",
  "pricing.update": "money",
  "subscription.change": "money",
  "payroll.run": "money",
  "record.delete": "destructive",
  "booking.cancel": "destructive",
  "user.role.change": "authz",
  "user.invite": "authz",
  "permission.update": "authz",
  "email.send": "outbound",
  "sms.send": "outbound",
  "campaign.send": "outbound",
  "customer.message": "outbound",
};

export type Verdict = {
  /** True only for a known routine action. Never true on any doubt. */
  auto: boolean;
  capability: Capability;
  /** Why it needs a human. Empty when auto is true. */
  reason: string;
  /** True when the action was not in the registry at all. */
  unknown: boolean;
};

const UNKNOWN_REASON =
  "Unrecognised action. Navigator asks before running anything it cannot classify.";

/**
 * Decide whether an action may run without a human tap.
 *
 * `autonomyEnabled` is the master switch from NavProfile. When it is false
 * nothing is auto, regardless of capability — the switch is checked here so
 * no caller can forget it.
 */
export function classify(action: string, autonomyEnabled: boolean): Verdict {
  try {
    const key = typeof action === "string" ? action.trim() : "";
    if (!key || !Object.prototype.hasOwnProperty.call(ACTION_CAPABILITY, key)) {
      return { auto: false, capability: "destructive", reason: UNKNOWN_REASON, unknown: true };
    }

    const capability = ACTION_CAPABILITY[key];

    if (isRed(capability)) {
      return { auto: false, capability, reason: RED_REASON[capability], unknown: false };
    }

    if (!autonomyEnabled) {
      return {
        auto: false,
        capability,
        reason: "Autonomous actions are switched off in Setup.",
        unknown: false,
      };
    }

    return { auto: true, capability, reason: "", unknown: false };
  } catch {
    // Classification itself failed. Never guess in the permissive direction.
    return { auto: false, capability: "destructive", reason: UNKNOWN_REASON, unknown: true };
  }
}

/** The red list rendered for the system prompt, so the model knows its own limits. */
export function redListPromptBlock(): string {
  return [
    "HARD LIMITS — you may NEVER do these without an explicit human tap, every time:",
    ...RED_CAPABILITIES.map((c) => `- ${RED_REASON[c]}`),
    "You may still draft and propose any of the above. You may not execute them.",
    "If you are unsure which category something falls into, treat it as needing a tap.",
  ].join("\n");
}
