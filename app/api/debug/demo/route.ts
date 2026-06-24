// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: "@rotahr.demo" } },
      select: { email: true, password: true, role: true, businessId: true },
    });
    return NextResponse.json({
      count: users.length,
      users: users.map(u => ({
        email: u.email,
        hasPassword: !!u.password,
        passwordPrefix: u.password?.slice(0, 10),
        role: u.role,
        businessId: u.businessId,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
