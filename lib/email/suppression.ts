import crypto from "crypto";
import { prisma } from "@/lib/db";

/**
 * Marketing opt-outs.
 *
 * Rules this file exists to enforce:
 *  - The opt-out is written to our own database first. The outreach service can
 *    be down (it has been) and an opt-out must never depend on it.
 *  - Nothing here throws at the caller. A failure to notify the outreach
 *    service must not stop us recording the opt-out.
 */

const SECRET =
  process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || "rotahr-unsubscribe";

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Signature for unsubscribe links, so a link can't be used to opt out an
 * address someone just typed in. Links without one still work — an opt-out is
 * never refused on a technicality — but signed ones are logged as verified.
 */
export function unsubscribeToken(email: string): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(normaliseEmail(email))
    .digest("hex")
    .slice(0, 16);
}

export function verifyUnsubscribeToken(email: string, token?: string | null): boolean {
  if (!token) return false;
  const expected = unsubscribeToken(email);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function unsubscribeUrl(email: string, baseUrl = "https://rotahr.com"): string {
  const e = normaliseEmail(email);
  return `${baseUrl}/unsubscribe?email=${encodeURIComponent(e)}&t=${unsubscribeToken(e)}`;
}

export async function isSuppressed(email: string): Promise<boolean> {
  const row = await prisma.emailSuppression.findUnique({ where: { email: normaliseEmail(email) } });
  return !!row && row.revokedAt === null;
}

export async function suppress(opts: {
  email: string;
  source?: string;
  reason?: string;
  userAgent?: string | null;
}): Promise<void> {
  const email = normaliseEmail(opts.email);
  await prisma.emailSuppression.upsert({
    where: { email },
    create: {
      email,
      source: opts.source ?? "unsubscribe_link",
      reason: opts.reason,
      userAgent: opts.userAgent ?? undefined,
    },
    update: {
      revokedAt: null,
      source: opts.source ?? "unsubscribe_link",
      reason: opts.reason,
      userAgent: opts.userAgent ?? undefined,
    },
  });
  await markLeadUnsubscribed(email);
  void notifyOutreachService(email);
}

/**
 * Mirrors the opt-out onto the lead row straight away.
 *
 * `sendToLead()` already flips a suppressed lead to `unsubscribed`, but only
 * when the lead next comes up for a send — so between the opt-out and that
 * moment the lead still reads `contacted`. Measured 12 Aug 2026: 39 active
 * suppressions and `status = 'unsubscribed'` on exactly 0 of 1,838 leads, which
 * made the opt-out rate look like zero in every report that counts by status.
 * Sending was never at risk (`isSuppressed()` is checked immediately before
 * each send); the number was.
 *
 * updateMany so an address that was never a lead matches nothing quietly, and
 * terminal states are left alone — `replied` and `bounced` say more about the
 * lead than `unsubscribed` does.
 */
async function markLeadUnsubscribed(email: string): Promise<void> {
  await prisma.outreachLead
    .updateMany({
      where: { email, status: { notIn: ["unsubscribed", "replied", "bounced", "converted"] } },
      data: { status: "unsubscribed" },
    })
    .catch(() => undefined);
}

export async function unsuppress(email: string): Promise<void> {
  const e = normaliseEmail(email);
  // updateMany, not update: the common case is an address that was never
  // suppressed, and `update` treats "no such row" as an error — it logged a
  // Prisma stack trace on a perfectly normal opt-in. updateMany matches zero
  // rows quietly.
  await prisma.emailSuppression
    .updateMany({ where: { email: e }, data: { revokedAt: new Date() } })
    .catch(() => undefined);

  // Put the lead back in the sequence, since leaving it on `unsubscribed` would
  // silently keep it out forever. The step it was on before the opt-out isn't
  // stored, so it resumes at `contacted` whenever it has been mailed at least
  // once — the cadence then waits the usual 5 days from `lastContacted`, so an
  // undo can never trigger an immediate send.
  await prisma.outreachLead
    .updateMany({
      where: { email: e, status: "unsubscribed", contactCount: { gt: 0 } },
      data: { status: "contacted" },
    })
    .catch(() => undefined);
  await prisma.outreachLead
    .updateMany({
      where: { email: e, status: "unsubscribed", contactCount: 0 },
      data: { status: "new" },
    })
    .catch(() => undefined);
}

/**
 * Best-effort mirror into the outreach service so its own lead list stops
 * sending. Deliberately swallows every error, including the service being
 * missing entirely.
 */
async function notifyOutreachService(email: string): Promise<void> {
  const base = process.env.EMAIL_SYSTEM_URL;
  if (!base) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    await fetch(`${base}/unsubscribe?email=${encodeURIComponent(email)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    // Service is down or gone. The suppression is already recorded locally,
    // which is what actually stops mail going out.
  }
}
