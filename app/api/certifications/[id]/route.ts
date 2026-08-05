export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { isResponse, notFound } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db";

// Tenant isolation: PATCH/DELETE used to write on a raw client-supplied ID, so
// any signed-in manager could edit or delete another business's certifications.
async function ownedCert(id: string, businessId: string) {
  return prisma.trainingCertification.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("training");
  if (isResponse(session)) return session;
  const businessId = session.user.businessId;
  if (!businessId) {
    return NextResponse.json({ error: "No business associated" }, { status: 400 });
  }

  if (!(await ownedCert(params.id, businessId))) return notFound();

  const body = await req.json();
  const { title, issuer, category, issuedDate, expiryDate, documentUrl, notes } = body;

  const cert = await prisma.trainingCertification.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(issuer !== undefined && { issuer }),
      ...(category !== undefined && { category }),
      ...(issuedDate !== undefined && { issuedDate: issuedDate ? new Date(issuedDate) : null }),
      ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
      ...(documentUrl !== undefined && { documentUrl }),
      ...(notes !== undefined && { notes }),
    },
  });
  return NextResponse.json({ certification: cert });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("training");
  if (isResponse(session)) return session;
  const businessId = session.user.businessId;
  if (!businessId) {
    return NextResponse.json({ error: "No business associated" }, { status: 400 });
  }

  if (!(await ownedCert(params.id, businessId))) return notFound();

  await prisma.trainingCertification.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
