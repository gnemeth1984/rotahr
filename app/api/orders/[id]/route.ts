// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { UserRole as Role } from "@/types/roles";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["draft", "sent", "received"]).optional(),
  notes: z.string().optional().nullable(),
  sentAt: z.string().optional().nullable(),
  receivedAt: z.string().optional().nullable(),
});

async function requireManager(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = session.user.role as Role;
  if (role !== Role.ADMIN && role !== Role.MANAGER) return null;
  const businessId = (session.user as any).businessId as string | undefined;
  if (!businessId) return null;
  return { session, businessId };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireManager(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const order = await prisma.supplierOrder.findFirst({
    where: { id: params.id, businessId: auth.businessId },
    include: {
      supplier: true,
      items: { include: { stockItem: { include: { supplier: { select: { name: true } } } } } },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ order });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireManager(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const result = patchSchema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: "Invalid input", details: result.error.flatten() }, { status: 400 });

  const existing = await prisma.supplierOrder.findFirst({ where: { id: params.id, businessId: auth.businessId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = { ...result.data };
  if (data.sentAt) data.sentAt = new Date(data.sentAt);
  if (data.receivedAt) data.receivedAt = new Date(data.receivedAt);

  // When marking received, update lastOrdered on all stock items in this order
  if (data.status === "received") {
    const items = await prisma.orderItem.findMany({ where: { orderId: params.id } });
    await Promise.all(items.map((item) =>
      prisma.stockItem.update({
        where: { id: item.stockItemId },
        data: { lastOrdered: new Date() },
      })
    ));
  }

  const order = await prisma.supplierOrder.update({
    where: { id: params.id },
    data,
    include: {
      supplier: { select: { id: true, name: true, email: true } },
      items: { include: { stockItem: { select: { id: true, name: true, unit: true } } } },
    },
  });

  return NextResponse.json({ order });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireManager(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.supplierOrder.findFirst({ where: { id: params.id, businessId: auth.businessId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.supplierOrder.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
