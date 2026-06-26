// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { resolveFeatureFlags, FEATURE_DEFINITIONS, FeatureFlags } from "@/lib/features";

// GET — return resolved feature flags for the business
export async function GET(req: NextRequest) {
  const session = await requireRole("MANAGER", "ADMIN");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { featureFlags: true },
  });

  const flags = resolveFeatureFlags(business?.featureFlags as FeatureFlags);
  return NextResponse.json({ flags, definitions: FEATURE_DEFINITIONS });
}

// PUT — save feature flags (MANAGER or ADMIN only)
export async function PUT(req: NextRequest) {
  const session = await requireRole("MANAGER", "ADMIN");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const body = await req.json();
  const { flags } = body;

  if (!flags || typeof flags !== "object") {
    return NextResponse.json({ error: "flags object required" }, { status: 400 });
  }

  // Validate: never let ADMIN be removed from any feature's roles
  // and enforce canDisable constraint
  const sanitized: FeatureFlags = {};
  for (const def of FEATURE_DEFINITIONS) {
    const key = def.key as keyof FeatureFlags;
    const incoming = flags[key];
    if (!incoming) continue;

    // Can't disable non-disableable features
    const enabled = def.canDisable === false ? true : (incoming.enabled ?? true);

    // Always keep ADMIN in roles list
    let roles: string[] = incoming.roles ?? [...def.defaultRoles];
    if (!roles.includes("ADMIN")) roles = [...roles, "ADMIN"];

    sanitized[key] = { enabled, roles };
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { featureFlags: sanitized },
  });

  const resolved = resolveFeatureFlags(sanitized);
  return NextResponse.json({ flags: resolved });
}
