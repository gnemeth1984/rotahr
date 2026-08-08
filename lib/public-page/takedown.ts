import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { normaliseEmail } from "@/lib/email/suppression";

/**
 * Removing a page we published for a venue that never asked for one.
 *
 * WHY THIS IS A ONE-CLICK LINK AND NOT A MAILTO
 * We publish these pages on the basis that it is in the venue's interest and in
 * ours (a legitimate interest, in GDPR terms). That basis only holds if the
 * person described can object easily and we act immediately. "Email us and
 * we'll take it down" puts a human step between the objection and the outcome,
 * and it is the step that gets missed on a busy week. So the invite email
 * carries a signed link that removes the page by itself.
 *
 * WHY THE TAKEDOWN OUTLIVES THE PAGE
 * Deleting only the Business row would leave the venue in the outreach lead
 * list, and the next bulk provisioning run would publish it again. One polite
 * request would become a repeat offence. ListingTakedown is keyed on a
 * normalised venue name so it still matches after the row is gone, and
 * provisioning refuses anything it finds there.
 */

/** Key we can still match on once the Business row has been deleted. */
export function takedownNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(the|ltd|limited|restaurant|bar|pub|cafe|café|inn|hotel)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export async function issueTakedownToken(businessId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await prisma.business.update({
    where: { id: businessId },
    data: { publicTakedownToken: token },
  });
  return token;
}

export interface TakedownTarget {
  id: string;
  name: string;
  slug: string | null;
  email: string | null;
}

/**
 * Look up a takedown token. Only ever resolves an unclaimed prospect page: once
 * somebody owns the business, removal is a destructive account operation and
 * belongs behind a login, not behind a link in an old email.
 */
export async function findTakedownTarget(token: string): Promise<TakedownTarget | null> {
  if (!token) return null;
  const b = await prisma.business.findFirst({
    where: { publicTakedownToken: token },
    select: {
      id: true,
      name: true,
      publicSlug: true,
      publicEmail: true,
      publicProspect: true,
      _count: { select: { users: true, employees: true } },
    },
  });
  if (!b) return null;
  if (b.publicProspect !== true) return null;
  if (b._count.users > 0 || b._count.employees > 0) return null;
  return { id: b.id, name: b.name, slug: b.publicSlug, email: b.publicEmail };
}

/**
 * Take the page down and remember that we were asked to.
 *
 * The Business row is deleted rather than hidden. Hiding it would leave the
 * venue's address and phone number in our database after they asked us to
 * remove it, which is the opposite of what they requested.
 */
export async function applyTakedown(
  target: TakedownTarget,
  opts: { reason?: string | null } = {}
): Promise<void> {
  const nameKey = takedownNameKey(target.name);

  await prisma.$transaction(async (tx) => {
    await tx.listingTakedown.upsert({
      where: { nameKey },
      create: {
        nameKey,
        email: target.email ? normaliseEmail(target.email) : null,
        slug: target.slug,
        reason: opts.reason ?? null,
      },
      update: { reason: opts.reason ?? null, slug: target.slug },
    });

    // Venue rows cascade from Business; an unclaimed prospect has nothing else
    // hanging off it.
    await tx.business.delete({ where: { id: target.id } });
  });

  // Also retire the outreach lead, so the sequence stops. Someone who asked us
  // to delete their page is not a warm lead.
  if (target.email) {
    await prisma.outreachLead
      .updateMany({
        where: { email: normaliseEmail(target.email) },
        data: { status: "unsubscribed" },
      })
      .catch(() => undefined);
  }
}

/** True when this venue has previously asked us not to list them. */
export async function isTakenDown(name: string, email?: string | null): Promise<boolean> {
  const nameKey = takedownNameKey(name);
  const byName = await prisma.listingTakedown.findUnique({ where: { nameKey } });
  if (byName) return true;
  if (!email) return false;
  const byEmail = await prisma.listingTakedown.findFirst({
    where: { email: normaliseEmail(email) },
  });
  return Boolean(byEmail);
}
