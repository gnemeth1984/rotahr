/**
 * "Why are you leaving?" — optional feedback shown on /unsubscribe only AFTER
 * the opt-out has already been written. It never gates or delays the
 * unsubscribe, and nothing here can put an address back on a list.
 *
 * Stored in ActivityLog (action "unsubscribe_feedback") so it needs no table.
 * One entry per address: answering again replaces the earlier answer.
 */
export const UNSUB_FEEDBACK_ACTION = "unsubscribe_feedback";

export const UNSUB_REASONS = [
  { id: "too_many", label: "Too many emails" },
  { id: "not_relevant", label: "Not relevant to my venue" },
  { id: "other_software", label: "I already use other rota software" },
  { id: "never_signed_up", label: "I never signed up for these" },
  { id: "not_now", label: "Not the right time" },
  { id: "other", label: "Something else" },
] as const;

export type UnsubReasonId = (typeof UNSUB_REASONS)[number]["id"];

export function isUnsubReason(v: unknown): v is UnsubReasonId {
  return typeof v === "string" && UNSUB_REASONS.some((r) => r.id === v);
}

export function unsubReasonLabel(id: string): string {
  return UNSUB_REASONS.find((r) => r.id === id)?.label ?? id;
}

export const UNSUB_COMMENT_MAX = 600;
