// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("training");
  if (isResponse(session)) return session;

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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("training");
  if (isResponse(session)) return session;

  await prisma.trainingCertification.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
