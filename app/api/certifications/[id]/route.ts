// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.trainingCertification.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
