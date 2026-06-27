import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  birthday: z.string().optional().nullable(),
  dietaryNotes: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  internalNotes: z.string().optional().nullable(),
  gdprConsent: z.boolean().optional(),
});

async function getCustomer(id: string, businessId: string) {
  return prisma.customer.findFirst({
    where: { id, businessId },
    include: {
      reservations: { orderBy: { date: "desc" }, take: 50 },
      crmNotes: {
        include: { author: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
      crmEmails: {
        include: { sentBy: { select: { name: true, email: true } } },
        orderBy: { sentAt: "desc" },
      },
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const customer = await getCustomer(id, session.user.businessId);
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(customer);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  // GDPR erasure flag
  if (body.anonymise === true) {
    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: "Deleted User",
        email: null,
        phone: null,
        birthday: null,
        dietaryNotes: null,
        allergies: null,
        internalNotes: null,
        tags: [],
        gdprConsent: false,
        gdprConsentAt: null,
        isAnonymised: true,
      },
    });
    return NextResponse.json(updated);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.birthday !== undefined) updateData.birthday = data.birthday ? new Date(data.birthday) : null;
  if (data.dietaryNotes !== undefined) updateData.dietaryNotes = data.dietaryNotes;
  if (data.allergies !== undefined) updateData.allergies = data.allergies;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
  if (data.gdprConsent !== undefined) {
    updateData.gdprConsent = data.gdprConsent;
    if (data.gdprConsent) updateData.gdprConsentAt = new Date();
  }

  const updated = await prisma.customer.update({ where: { id }, data: updateData });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Soft-anonymise (GDPR compliant)
  const updated = await prisma.customer.update({
    where: { id },
    data: {
      name: "Deleted User",
      email: null,
      phone: null,
      birthday: null,
      dietaryNotes: null,
      allergies: null,
      internalNotes: null,
      tags: [],
      gdprConsent: false,
      isAnonymised: true,
    },
  });

  return NextResponse.json({ ok: true });
}
