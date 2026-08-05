import { NextRequest, NextResponse } from "next/server";
import { requireTenant, isResponse, notFound } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";

// Tenant isolation: PATCH previously accepted any authenticated user and wrote
// on a raw client-supplied ID — so anyone signed in could rename or complete
// another business's onboarding tasks. Staff may now tick their OWN tasks
// complete; editing title/dueDate is manager/admin only.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await requireTenant();
  if (isResponse(t)) return t;

  const { id } = await params;
  const existing = await prisma.onboardingTask.findFirst({
    where: { id, businessId: t.businessId },
    select: { id: true, employee: { select: { userId: true } } },
  });
  if (!existing) return notFound();

  const body = await req.json();
  const { completed, title, dueDate } = body;

  const editsMetadata = title !== undefined || dueDate !== undefined;
  const isOwnTask = existing.employee?.userId === t.userId;
  if (editsMetadata && !t.isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!t.isManager && !isOwnTask) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (typeof completed === "boolean") {
    data.completed = completed;
    data.completedAt = completed ? new Date() : null;
  }
  if (title !== undefined) data.title = title;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

  const task = await prisma.onboardingTask.update({ where: { id }, data });
  return NextResponse.json({ task });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await requireTenant({ manager: true });
  if (isResponse(t)) return t;

  const { id } = await params;
  const existing = await prisma.onboardingTask.findFirst({
    where: { id, businessId: t.businessId },
    select: { id: true },
  });
  if (!existing) return notFound();

  await prisma.onboardingTask.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
