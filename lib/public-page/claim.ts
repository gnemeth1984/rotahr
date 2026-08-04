import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Claiming a prospect page.
 *
 * WHY THIS EXISTS
 * `createProspectVenuePage()` publishes a page at /v/<slug> for a venue we
 * don't run, and stores a `publicClaimToken` on the business. Nothing consumed
 * that token — there was no route, no page, no email. So every prospect page
 * was permanently unclaimable: the real owner could see a page about their
 * business and had no way to take it over. That is a goodwill problem before
 * it's a conversion problem.
 *
 * SECURITY MODEL
 * The token must never appear on the public page, or anyone who loaded the page
 * could claim someone else's venue. So the flow is:
 *   1. Visitor clicks "Is this your venue?" and submits the slug.
 *   2. We email the claim link to the contact address ALREADY on file for that
 *      venue — the one we sourced when we built the page. We never accept a
 *      destination address from the request.
 *   3. Possession of that mailbox is the proof of ownership.
 * Responses are deliberately identical whether or not a claimable page exists,
 * so this can't be used to enumerate which venues we hold pages for.
 */

export interface ClaimableBusiness {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
}

/** A prospect page is claimable only while nobody has an account on it. */
export async function findClaimable(where: { slug?: string; token?: string }): Promise<ClaimableBusiness | null> {
  if (!where.slug && !where.token) return null;

  const business = await prisma.business.findFirst({
    where: where.token
      ? { publicClaimToken: where.token }
      : { publicSlug: where.slug },
    select: {
      id: true,
      name: true,
      publicSlug: true,
      publicEmail: true,
      publicProspect: true,
      publicClaimToken: true,
      _count: { select: { users: true, employees: true } },
      venues: { where: { isDefault: true }, take: 1, select: { email: true } },
    },
  });

  if (!business) return null;
  if (business.publicProspect !== true) return null;
  if (!business.publicSlug || !business.publicClaimToken) return null;
  // Already claimed, or somehow a real account. Either way, not up for grabs.
  if (business._count.users > 0 || business._count.employees > 0) return null;

  return {
    id: business.id,
    name: business.name,
    slug: business.publicSlug,
    contactEmail: business.publicEmail || business.venues[0]?.email || null,
  };
}

/**
 * Rotate the token each time a claim link is sent, so an old link in an
 * inbox or a proxy log stops working.
 */
export async function issueClaimToken(businessId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await prisma.business.update({
    where: { id: businessId },
    data: { publicClaimToken: token },
  });
  return token;
}

export function claimEmailHtml(opts: { venueName: string; url: string; slug: string }) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a">
      <h1 style="font-size:20px;margin:0 0 16px">Claim the page for ${escapeHtml(opts.venueName)}</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px">
        Someone asked to claim the Rotahr page at <strong>rotahr.com/v/${escapeHtml(opts.slug)}</strong>.
        We built that page for ${escapeHtml(opts.venueName)}; we don't run the venue.
      </p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
        If that was you, use the button below to take control of it. You'll set a
        password and the page becomes yours to edit — opening hours, menu, photos,
        bookings, the lot. If it wasn't you, ignore this email and nothing changes.
      </p>
      <p style="margin:0 0 24px">
        <a href="${opts.url}" style="display:inline-block;background:#F97316;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">Claim this page</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#475569;margin:0">
        This link expires the next time a claim is requested. If you'd rather the
        page came down entirely, reply and we'll remove it.
      </p>
    </div>
  `;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}
