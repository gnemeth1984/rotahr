// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import Expo from "expo-server-sdk";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await req.json().catch(() => ({}));

  if (!token || !Expo.isExpoPushToken(token)) {
    return NextResponse.json({ error: "Invalid push token" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { pushToken: token },
  });

  return NextResponse.json({ ok: true });
}

// Allow clearing the token on logout
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { pushToken: null },
  });

  return NextResponse.json({ ok: true });
}
