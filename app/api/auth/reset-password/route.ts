// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) return NextResponse.json({ error: "Token and password required" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!record) return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    if (record.used) return NextResponse.json({ error: "This link has already been used" }, { status: 400 });
    if (record.expiresAt < new Date()) return NextResponse.json({ error: "Link has expired — request a new one" }, { status: 400 });

    const hash = await bcrypt.hash(password, 12);

    await prisma.user.update({ where: { id: record.userId }, data: { password: hash } });
    await prisma.passwordResetToken.update({ where: { token }, data: { used: true } });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  }
}
