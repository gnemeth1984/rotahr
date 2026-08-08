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
  void notifyOutreachService(email);
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
