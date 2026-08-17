import { Resend } from "resend";
import { isUnroutableAddress } from "@/lib/email/send";

/**
 * Resend audience hygiene.
 *
 * WHY THIS EXISTS
 * `sendEmail()` in lib/email/send.ts filters unroutable recipients out of
 * every one-to-one send, but a broadcast is a single API call against a whole
 * audience — Resend expands the recipient list server-side, so nothing in our
 * code ever sees the individual addresses and the filter cannot apply.
 *
 * That means one demo address left in an audience hard-bounces on every
 * campaign, forever, against the same domain that sends real outreach and
 * password resets. Bounce rate is the main signal mailbox providers use to
 * decide whether a domain is trustworthy, so this is cleaned before each send
 * rather than left for someone to notice in the log.
 *
 * It lives in lib/ and not in the contacts route because a Next.js route file
 * may only export request handlers — an extra export there fails the build.
 */
function client(): Resend {
  return new Resend(process.env.RESEND_API_KEY!);
}

export interface PurgeResult {
  removed: number;
  addresses: string[];
  error?: string;
}

/**
 * Strip every unroutable address out of an audience and report what went.
 * Safe to call before any send: with a clean audience it removes nothing.
 */
export async function purgeUnroutableContacts(audienceId: string): Promise<PurgeResult> {
  const resend = client();
  const { data, error } = await resend.contacts.list({ audienceId });
  if (error) return { removed: 0, addresses: [], error: error.message };

  const bad = (data?.data ?? []).filter((c) => isUnroutableAddress(c.email));
  const addresses: string[] = [];
  for (const c of bad) {
    const res = await resend.contacts.remove(c.id);
    // A failed removal is logged rather than thrown: the remaining addresses
    // still need clearing, and reporting a partial purge honestly beats
    // abandoning the run on the first error.
    if (res.error) {
      console.error(`[email:purge] could not remove ${c.email}:`, res.error.message);
      continue;
    }
    addresses.push(c.email);
  }
  return { removed: addresses.length, addresses };
}
