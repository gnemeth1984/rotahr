import { NextResponse } from "next/server";
import { requireTenant, isResponse, notFound } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db";
import { resolveFlag } from "@/lib/services/notification.service";

// Tenant isolation: this resolved a flag by raw ID with no business check, so a
// manager could clear another business's booking flags. Scope through the
// reservation relation (BookingFlag has no businessId column).
export async function PATCH(
  _req: Request,
  { params }: { params: { id: string; flagId: string } }
) {
  try {
    const t = await requireTenant({ manager: true });
    if (isResponse(t)) return t;

    const flagRow = await prisma.bookingFlag.findFirst({
      where: {
        id: params.flagId,
        reservationId: params.id,
        reservation: { businessId: t.businessId },
      },
      select: { id: true },
    });
    if (!flagRow) return notFound();

    const flag = await resolveFlag(params.flagId);
    return NextResponse.json({ flag });
  } catch (err) {
    console.error("PATCH /api/bookings/[id]/flags/[flagId]/resolve", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
