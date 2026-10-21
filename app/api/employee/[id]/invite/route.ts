import { NextRequest, NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { inviteEmployee } from "@/lib/services/invite.service";

/**
 * POST /api/employee/:id/invite — send (or resend) a staff login invite.
 * Managers/admins only, scoped to their business.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole("ADMIN", "MANAGER");
  if (isResponse(session)) return session;
  if (!session.user.businessId) {
    return NextResponse.json({ error: "No business associated" }, { status: 400 });
  }

  const result = await inviteEmployee({
    employeeId: params.id,
    businessId: session.user.businessId,
    invitedBy: { id: session.user.id, name: session.user.name, email: session.user.email },
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code });
  return NextResponse.json({ ok: true, status: result.status, email: result.email });
}
