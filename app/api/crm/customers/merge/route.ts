import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const mergeSchema = z.object({
  keepId: z.string(),
  mergeId: z.string(),
});

// Merge mergeId into keepId — move all relations to keepId, delete mergeId
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { keepId, mergeId } = parsed.data;

  const [keep, merge] = await Promise.all([
    prisma.customer.findFirst({ where: { id: keepId, businessId: session.user.businessId } }),
    prisma.customer.findFirst({ where: { id: mergeId, businessId: session.user.businessId } }),
  ]);

  if (!keep || !merge) return NextResponse.json({ error: "One or both customers not found" }, { status: 404 });
  if (keepId === mergeId) return NextResponse.json({ error: "Cannot merge a customer with itself" }, { status: 400 });

  // Move relations
  await prisma.$transaction([
    prisma.reservation.updateMany({ where: { customerId: mergeId }, data: { customerId: keepId } }),
    prisma.crmNote.updateMany({ where: { customerId: mergeId }, data: { customerId: keepId } }),
    prisma.crmEmail.updateMany({ where: { customerId: mergeId }, data: { customerId: keepId } }),
    // Merge tags
    prisma.customer.update({
      where: { id: keepId },
      data: {
        tags: Array.from(new Set([...keep.tags, ...merge.tags])),
        phone: keep.phone ?? merge.phone,
        birthday: keep.birthday ?? merge.birthday,
        dietaryNotes: [keep.dietaryNotes, merge.dietaryNotes].filter(Boolean).join("; ") || null,
        allergies: [keep.allergies, merge.allergies].filter(Boolean).join("; ") || null,
        internalNotes: [keep.internalNotes, merge.internalNotes].filter(Boolean).join("\n---\n") || null,
        gdprConsent: keep.gdprConsent || merge.gdprConsent,
        gdprConsentAt: keep.gdprConsentAt ?? merge.gdprConsentAt,
      },
    }),
    prisma.customer.delete({ where: { id: mergeId } }),
  ]);

  return NextResponse.json({ ok: true, keepId });
}
