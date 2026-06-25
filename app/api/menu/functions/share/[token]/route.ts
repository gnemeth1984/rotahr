import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public — no auth required
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const menu = await prisma.functionMenu.findUnique({
    where: { shareToken: params.token },
    include: {
      business: { select: { name: true } },
      courses: {
        orderBy: { sortOrder: "asc" },
        include: { dishes: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!menu || !menu.isActive) return NextResponse.json({ error: "Menu not found" }, { status: 404 });
  return NextResponse.json({ menu });
}
