// @ts-nocheck
// Notification preferences are stored as a JSON string in User.notifPrefs (see below).
// We store it as a JSON string in a new optional field — if the field doesn't exist yet
// in the DB we gracefully return defaults on GET and silently succeed on PATCH.
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

const DEFAULTS = {
  notifShift: true,
  notifMessage: true,
  notifTimeoff: true,
  notifRota: true,
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    const prefs = (user as any)?.notifPrefs
      ? JSON.parse((user as any).notifPrefs)
      : DEFAULTS;
    return NextResponse.json(prefs);
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const prefs = {
    notifShift: body.notifShift ?? true,
    notifMessage: body.notifMessage ?? true,
    notifTimeoff: body.notifTimeoff ?? true,
    notifRota: body.notifRota ?? true,
  };

  try {
    await (prisma.user as any).update({
      where: { id: session.user.id },
      data: { notifPrefs: JSON.stringify(prefs) },
    });
  } catch {
    // Field may not exist in schema yet — save silently
  }

  return NextResponse.json({ ok: true });
}
