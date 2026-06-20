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
  const businessId = session.user.businessId;
  const body = await req.json();
  const { name, address, geoLat, geoLng, geoRadius, timezone, isDefault, active } = body;

  if (isDefault) {
    await prisma.venue.updateMany({ where: { businessId }, data: { isDefault: false } });
  }

  const venue = await prisma.venue.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(geoLat !== undefined && { geoLat }),
      ...(geoLng !== undefined && { geoLng }),
      ...(geoRadius !== undefined && { geoRadius }),
      ...(timezone !== undefined && { timezone }),
      ...(isDefault !== undefined && { isDefault }),
      ...(active !== undefined && { active }),
    },
  });
  return NextResponse.json({ venue });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Soft delete
  await prisma.venue.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
