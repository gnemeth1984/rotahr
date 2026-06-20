import { getServerSession } from "next-auth/next";
import { authOptions } from "./options";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: string;
    businessId: string | null;
  };
}

export async function requireAuth(): Promise<AuthSession | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session as AuthSession;
}

export async function requireRole(
  ...roles: string[]
): Promise<AuthSession | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  if (!roles.includes(result.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return result;
}

export async function requireBusiness(
  businessId: string,
  ...roles: string[]
): Promise<AuthSession | NextResponse> {
  const result = await requireRole(...roles);
  if (result instanceof NextResponse) return result;
  if (result.user.businessId !== businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return result;
}

/**
 * requirePermission — passes if:
 *  1. User is ADMIN or MANAGER (always allowed), OR
 *  2. User's Employee record has the given permission string in their permissions[]
 *
 * Use this instead of requireRole("ADMIN","MANAGER") on module-specific routes.
 */
export async function requirePermission(
  permission: string
): Promise<AuthSession | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;

  const { role, id, businessId } = result.user;

  // Managers + Admins always pass
  if (role === "ADMIN" || role === "MANAGER") return result;

  if (!businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Look up the employee record for this user in this business
  const employee = await prisma.employee.findFirst({
    where: { userId: id, businessId },
    select: { permissions: true },
  });

  if (employee?.permissions?.includes(permission)) return result;

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function isResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}
