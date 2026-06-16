import { getServerSession } from "next-auth/next";
import { authOptions } from "./options";
import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: UserRole;
    businessId: string | null;
  };
}

/**
 * Require authentication. Returns session or a 401 response.
 */
export async function requireAuth(): Promise<AuthSession | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session as AuthSession;
}

/**
 * Require one of the given roles.
 */
export async function requireRole(
  ...roles: UserRole[]
): Promise<AuthSession | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  if (!roles.includes(result.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return result;
}

/**
 * Require session + businessId match (data isolation).
 */
export async function requireBusiness(
  businessId: string,
  ...roles: UserRole[]
): Promise<AuthSession | NextResponse> {
  const result = await requireRole(...roles);
  if (result instanceof NextResponse) return result;
  if (result.user.businessId !== businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return result;
}

export function isResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}
