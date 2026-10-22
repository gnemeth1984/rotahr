/**
 * Who may use the Manager Copilot.
 *
 * The Copilot shows guest names, allergy notes, staff certificates and margins,
 * so it is a manager tool: ADMIN or MANAGER of the business, or an employee a
 * manager has explicitly granted the "copilot" permission. Always scoped to the
 * session's businessId — never to an id from the request.
 *
 * Separate from the founder Navigator (lib/navigator/guard.ts), which is
 * platform super-admin only and spans tenants.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { resolveFeatureFlags, type FeatureFlags } from "@/lib/features";
import { ScopeError } from "./copilot";

export const COPILOT_PERMISSION = "copilot";

export interface CopilotUser {
  userId: string;
  businessId: string;
  role: string;
  isManager: boolean;
}

export async function requireCopilot(): Promise<CopilotUser | NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string; businessId?: string | null } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });

  const role = user.role ?? "";
  const isManager = role === "ADMIN" || role === "MANAGER";
  const [business, employee] = await Promise.all([
    prisma.business.findUnique({ where: { id: user.businessId }, select: { featureFlags: true } }),
    isManager
      ? Promise.resolve(null)
      : prisma.employee.findFirst({ where: { userId: user.id, businessId: user.businessId, active: true }, select: { permissions: true } }),
  ]);
  if (!business) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isManager && !employee?.permissions?.includes(COPILOT_PERMISSION))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const flags = resolveFeatureFlags(business.featureFlags as FeatureFlags | null);
  if (!flags.copilot.enabled)
    return NextResponse.json({ error: "Manager Copilot is turned off for this business" }, { status: 403 });
  // Managers follow the feature's role list (an admin can restrict it to
  // ADMIN). A staff member with the explicit "copilot" grant is let through.
  if (isManager && !flags.copilot.roles.includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return { userId: user.id, businessId: user.businessId, role, isManager };
}

export function scopeErrorResponse(err: unknown): NextResponse {
  if (err instanceof ScopeError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error("[copilot] request failed:", err);
  return NextResponse.json({ error: "Copilot failed" }, { status: 500 });
}
