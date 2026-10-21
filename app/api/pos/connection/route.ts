import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reassignSnapshots } from "@/lib/pos/snapshots";
import { resolveVenueId } from "@/lib/venues/resolve";

const patchSchema = z.object({
  // null = automatic: sync falls back to the business's only / default venue
  venueId: z.string().min(1).nullable(),
  // Also move snapshots from before today. Today's row always moves.
  reassignHistory: z.boolean().optional().default(false),
});

/** Choose which venue the connected till's takings belong to. */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { venueId, reassignHistory } = parsed.data;

  const conn = await prisma.posConnection.findUnique({
    where: { businessId },
    select: { id: true, provider: true },
  });
  if (!conn) return NextResponse.json({ error: "No POS connected" }, { status: 404 });

  if (venueId) {
    // Never trust a client-supplied venue id across tenants.
    const v = await prisma.venue.findFirst({
      where: { id: venueId, businessId },
      select: { id: true },
    });
    if (!v) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }

  await prisma.posConnection.update({ where: { businessId }, data: { venueId } });
  // Same rule sync uses, so moved rows land where the next sync will write.
  const effectiveVenueId = venueId ?? (await resolveVenueId(businessId));
  const moved = await reassignSnapshots(businessId, conn.provider, effectiveVenueId, reassignHistory);

  return NextResponse.json({ venueId, effectiveVenueId, movedSnapshots: moved });
}
