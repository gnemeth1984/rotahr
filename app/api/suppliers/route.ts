// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { UserRole as Role } from "@/types/roles";
import { z } from "zod";

const supplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
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

export async function GET(req: NextRequest) {
  const auth = await requireManager(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") !== "false";

  const suppliers = await prisma.supplier.findMany({
    where: { businessId: auth.businessId, ...(activeOnly ? { active: true } : {}) },
    include: {
      _count: { select: { stockItems: true, orders: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ suppliers });
}

export async function POST(req: NextRequest) {
  const auth = await requireManager(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const result = supplierSchema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: "Invalid input", details: result.error.flatten() }, { status: 400 });

  const supplier = await prisma.supplier.create({
    data: { businessId: auth.businessId, ...result.data },
  });

  return NextResponse.json({ supplier }, { status: 201 });
}
