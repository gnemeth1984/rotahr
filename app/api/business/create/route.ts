import { NextRequest, NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { businessService, createBusinessSchema } from "@/lib/services/business.service";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await requireRole("ADMIN");
  if (isResponse(session)) return session;

  const body = await req.json();
  const parsed = createBusinessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const business = await businessService.create(parsed.data.name, session.user.id);

    // Link admin to this business
    await prisma.user.update({
      where: { id: session.user.id },
      data: { businessId: business.id },
    });

    return NextResponse.json({ business }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
