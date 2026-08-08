import { prisma } from "@/lib/prisma";
import { normaliseEmail, suppress, unsuppress } from "@/lib/email/suppression";

/**
 * Marketing consent for venues that claimed a page we built for them.
 *
 * THE RULE THIS FILE ENFORCES
 * Claiming a listing is not consent to be marketed to. They are two separate
 * acts, and we record them separately.
 *
 * Why that matters commercially, not just legally: a large share of Irish pubs
 * and restaurants trade as sole traders or partnerships. Under the ePrivacy
 * Regulations (S.I. 336/2011, reg. 13) those are "individual subscribers", the
 * same category as a private person — unsolicited marketing email to them needs
 * prior consent. Only companies with their own legal personality fall under the
 * lighter opt-out rule. We cannot tell which is which from a venue name, so the
 * list has to be treated as if it were all individual subscribers.
 *
 * So the nurture list is consent-only, the checkbox is unticked by default, and
 * every grant and withdrawal is appended to MarketingConsentEvent with the
 * wording that was on screen at the time.
 */

/**
 * The wording shown beside the checkbox. Versioned deliberately: consent is only
 * valid for what the person was told, so when this changes the old text stays
 * attached to the old events rather than being retconned.
 */
export const MARKETING_CONSENT_TEXT_V1 =
  "Email me occasional Rotahr product updates and articles for hospitality " +
  "operators. No more than a couple a month, and one click unsubscribes.";

export interface RecordConsentInput {
  email: string;
  businessId?: string | null;
  granted: boolean;
  source: "claim_form" | "unsubscribe_link" | "admin" | "settings";
  consentText?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Write a consent decision: the audit event, the queryable flag on the
 * business, and the suppression list.
 *
 * Withdrawal also writes to EmailSuppression. Without that, a withdrawal would
 * only stop nurture mail while cold outreach carried on — the sequence reads
 * suppression, not this flag.
 */
export async function recordMarketingConsent(input: RecordConsentInput): Promise<void> {
  const email = normaliseEmail(input.email);

  await prisma.marketingConsentEvent.create({
    data: {
      email,
      businessId: input.businessId ?? null,
      granted: input.granted,
      source: input.source,
      consentText: input.consentText ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });

  if (input.businessId) {
    await prisma.business.update({
      where: { id: input.businessId },
      data: input.granted
        ? { marketingOptIn: true, marketingOptInAt: new Date(), marketingOptOutAt: null, marketingEmail: email }
        : { marketingOptIn: false, marketingOptOutAt: new Date() },
    });
  }

  if (input.granted) {
    // Someone who has just asked for our emails should not stay on a
    // suppression list from an earlier opt-out.
    await unsuppress(email);
  } else {
    await suppress({
      email,
      source: input.source,
      reason: "marketing consent withdrawn",
      userAgent: input.userAgent ?? null,
    });
  }
}

/**
 * Withdraw consent for an address, wherever it came from.
 *
 * Called from the unsubscribe route, which knows an email address but not a
 * business, so the business is resolved by address here. Withdrawal must never
 * depend on that lookup succeeding: the audit event is written regardless, and
 * suppression (already handled by the caller for one-click unsubscribes) is
 * what actually stops mail.
 */
export async function withdrawMarketingConsent(input: {
  email: string;
  source: "claim_form" | "unsubscribe_link" | "admin" | "settings";
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const email = normaliseEmail(input.email);

  const businesses = await prisma.business.findMany({
    where: { marketingEmail: email, marketingOptIn: true },
    select: { id: true },
  });

  await prisma.marketingConsentEvent.create({
    data: {
      email,
      businessId: businesses[0]?.id ?? null,
      granted: false,
      source: input.source,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });

  if (businesses.length > 0) {
    await prisma.business.updateMany({
      where: { id: { in: businesses.map((b) => b.id) } },
      data: { marketingOptIn: false, marketingOptOutAt: new Date() },
    });
  }
}

/**
 * Businesses that may receive a nurture email.
 *
 * Suppression is checked per-recipient at send time rather than filtered here,
 * because a withdrawal can land while a batch is in flight.
 */
export async function nurtureAudience(limit = 500) {
  return prisma.business.findMany({
    where: {
      marketingOptIn: true,
      marketingOptOutAt: null,
      marketingEmail: { not: null },
    },
    select: { id: true, name: true, marketingEmail: true, publicSlug: true },
    orderBy: { marketingOptInAt: "asc" },
    take: limit,
  });
}
