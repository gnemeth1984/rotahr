/**
 * Email verdict values and the send/no-send decision.
 *
 * Deliberately separate from `smtp-verify.ts`: that module imports `node:net`
 * and `node:dns` to speak SMTP, and the sender only needs to compare a string.
 * Importing the prober just to read a verdict would pull raw sockets into every
 * bundle that sends mail, including request handlers that can never use them.
 */
export type EmailVerdict = "ok" | "dead" | "catch-all" | "no-mx" | "unknown";

/**
 * True only for verdicts that prove mail cannot arrive.
 *
 * `unknown` (greylisting, timeout, blocked probe, DNS wobble) and `catch-all`
 * (server accepts every address, so an accept proves nothing) both stay
 * sendable. The asymmetry is the point: a false `dead` silently deletes a real
 * prospect from the list, which is far more expensive than one bounce.
 */
export function isUndeliverable(verdict: string | null | undefined): boolean {
  return verdict === "dead" || verdict === "no-mx";
}
