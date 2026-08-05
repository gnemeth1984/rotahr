import { NextRequest, NextResponse } from "next/server";
import { requireTenant, isResponse, notFound } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";

// Tenant isolation: this used to delete on a raw client-supplied ID, so any
// manager could delete another business's employee documents.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await requireTenant({ manager: true });
  if (isResponse(t)) return t;

  const { id } = await params;
  const doc = await prisma.employeeDocument.findFirst({
    where: { id, businessId: t.businessId },
    select: { id: true },
  });
  if (!doc) return notFound();

  await prisma.employeeDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
