// @ts-nocheck
export const dynamic = "force-dynamic";

/**
 * GET  /api/menu/dishes/allergens   → the allergen matrix for the venue's menu
 * PATCH /api/menu/dishes/allergens  → confirm one dish's row
 *
 * The matrix is what makes the allergen course venue-specific, so it is stamped
 * with who confirmed it and when. A blank row is NOT a confirmed absence — that
 * distinction is the whole point of allergenCheckedAt, and the course teaches
 * it.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { ALLERGENS, serialiseTraces } from "@/lib/training/allergens";
import { logActivity } from "@/lib/services/activity.service";

const FIELDS = ALLERGENS.map((a) => a.field);

const SELECT = {
  id: true,
  name: true,
  category: true,
  active: true,
  allergenTraces: true,
  allergenNotes: true,
  allergenCheckedAt: true,
  allergenCheckedBy: true,
  ...Object.fromEntries(FIELDS.map((f) => [f, true])),
};

export async function GET(req: NextRequest) {
  // Any signed-in employee may read it — a chef needs the matrix on the line.
  const session = await requireAuth();
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ dishes: [], allergens: [] });

  const dishes = await prisma.dish.findMany({
    where: { businessId, active: true },
    select: SELECT,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    dishes,
    allergens: ALLERGENS.map((a) => ({
      key: a.key,
      field: a.field,
      label: a.label,
      scope: a.scope,
      hides: a.hides,
    })),
    checked: dishes.filter((d) => d.allergenCheckedAt).length,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await requirePermission("menu");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const dish = await prisma.dish.findFirst({
    where: { id: body.id, businessId },
    select: { id: true, name: true },
  });
  if (!dish) return NextResponse.json({ error: "Dish not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  for (const f of FIELDS) {
    if (typeof body[f] === "boolean") data[f] = body[f];
  }
  if (Array.isArray(body.traces)) {
    data.allergenTraces = serialiseTraces(body.traces);
  }
  if (typeof body.allergenNotes === "string") {
    data.allergenNotes = body.allergenNotes.trim() || null;
  }

  // Confirming is an explicit act, not a side effect of ticking a box.
  if (body.confirm) {
    data.allergenCheckedAt = new Date();
    data.allergenCheckedBy = session.user.name || session.user.email || "Unknown";
  } else if (body.unconfirm) {
    data.allergenCheckedAt = null;
    data.allergenCheckedBy = null;
  }

  const updated = await prisma.dish.update({
    where: { id: dish.id },
    data,
    select: SELECT,
  });

  if (body.confirm) {
    logActivity({
      businessId,
      userId: session.user.id,
      userName: session.user.name,
      action: "allergens_confirmed",
      detail: dish.name,
    });
  }

  return NextResponse.json({ dish: updated });
}
