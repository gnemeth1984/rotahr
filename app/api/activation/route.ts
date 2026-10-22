export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { getActivation } from "@/lib/activation/progress";

/**
 * GET /api/activation — the setup checklist for the signed-in manager's business.
 * Read-only. Invites still go through POST /api/employee/:id/invite, one per
 * person, so the existing checks (scoping, linking, resend) apply unchanged.
 */
export async function GET() {
  const session = await requireRole("ADMIN", "MANAGER");
  if (isResponse(session)) return session;
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });

  const progress = await getActivation(businessId);
  if (!progress) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  // Staff the "Invite your team" step can act on: active, no login, not the owner.
  const pending = await prisma.employee.findMany({
    where: {
      businessId,
      active: true,
      userId: null,
      ...(progress.ownerEmail ? { NOT: { email: { equals: progress.ownerEmail, mode: "insensitive" } } } : {}),
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json({
    progress,
    awaitingInvite: pending.map((e) => ({
      id: e.id,
      // CSV import stores a one-word name with lastName "." — don't show the dot.
      name: `${e.firstName} ${e.lastName === "." ? "" : e.lastName}`.trim(),
      email: e.email,
    })),
  });
}
