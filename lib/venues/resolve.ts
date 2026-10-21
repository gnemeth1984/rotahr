import { prisma } from "@/lib/db";

/**
 * Work out which Venue a new booking / POS snapshot belongs to.
 *
 * 1. An explicit venueId is honoured only if it belongs to this business
 *    (never trust a client-supplied id across tenants).
 * 2. Otherwise, a business with exactly one active venue gets that venue.
 * 3. Otherwise, the business's default venue, if one is flagged.
 * 4. Otherwise null — better unattributed than attributed to the wrong site.
 */
export async function resolveVenueId(
  businessId: string,
  requestedVenueId?: string | null
): Promise<string | null> {
  if (requestedVenueId) {
    const v = await prisma.venue.findFirst({
      where: { id: requestedVenueId, businessId },
      select: { id: true },
    });
    if (v) return v.id;
  }

  const venues = await prisma.venue.findMany({
    where: { businessId, active: true },
    select: { id: true, isDefault: true },
    take: 50,
  });
  if (venues.length === 1) return venues[0].id;
  return venues.find((v) => v.isDefault)?.id ?? null;
}
