import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { UserRole } from "@/types/roles";

const ALLOWED_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

const VALID_TYPES = [
  "cleaning_daily",
  "cleaning_weekly",
  "cleaning_deep",
  "opening_checks",
  "closing_checks",
];

// GET /api/haccp/checklist-templates?checkType=cleaning_daily
// Returns all templates for the business if no checkType provided
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const checkType = req.nextUrl.searchParams.get("checkType");

  if (checkType) {
    const tmpl = await prisma.hACCPChecklistTemplate.findUnique({
      where: {
        businessId_checkType: {
          businessId: session.user.businessId,
          checkType,
        },
      },
    });
    return NextResponse.json({ items: tmpl ? (tmpl.items as string[]) : null });
  }

  // Return all templates
  const templates = await prisma.hACCPChecklistTemplate.findMany({
    where: { businessId: session.user.businessId },
  });
  const map: Record<string, string[]> = {};
  for (const t of templates) {
    map[t.checkType] = t.items as string[];
  }
  return NextResponse.json({ templates: map });
}

// PUT /api/haccp/checklist-templates
// Body: { checkType: string, items: string[] }
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { checkType, items } = body as { checkType: string; items: string[] };

  if (!VALID_TYPES.includes(checkType)) {
    return NextResponse.json({ error: "Invalid checkType" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.some((i) => typeof i !== "string")) {
    return NextResponse.json({ error: "items must be string[]" }, { status: 400 });
  }
  // Remove empty strings
  const cleaned = items.map((i) => i.trim()).filter(Boolean);

  const tmpl = await prisma.hACCPChecklistTemplate.upsert({
    where: {
      businessId_checkType: {
        businessId: session.user.businessId,
        checkType,
      },
    },
    create: {
      businessId: session.user.businessId,
      checkType,
      items: cleaned,
      updatedById: session.user.id,
    },
    update: {
      items: cleaned,
      updatedById: session.user.id,
    },
  });

  return NextResponse.json({ ok: true, items: tmpl.items });
}

// DELETE /api/haccp/checklist-templates?checkType=cleaning_daily
// Resets to defaults (removes custom template)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const checkType = req.nextUrl.searchParams.get("checkType");
  if (!checkType || !VALID_TYPES.includes(checkType)) {
    return NextResponse.json({ error: "Invalid checkType" }, { status: 400 });
  }

  await prisma.hACCPChecklistTemplate.deleteMany({
    where: { businessId: session.user.businessId, checkType },
  });

  return NextResponse.json({ ok: true });
}
