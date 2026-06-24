import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/push-subscription — save Web Push subscription JSON
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!body?.endpoint) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { pushSubscription: JSON.stringify(body) },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/push-subscription — clear subscription
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { pushSubscription: null },
  });

  return NextResponse.json({ ok: true });
}
