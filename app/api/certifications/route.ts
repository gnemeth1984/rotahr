// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

function certStatus(expiryDate: Date | null): string {
  if (!expiryDate) return "NO_EXPIRY";
  const now = new Date();
  const days = (expiryDate.getTime() - now.getTime()) / 86400000;
  if (days < 0) return "EXPIRED";
  if (days <= 30) return "EXPIRING_SOON";
  return "VALID";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ certifications: [] });

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const category = searchParams.get("category");

  const certs = await prisma.trainingCertification.findMany({
    where: {
      businessId,
      ...(employeeId && { employeeId }),
      ...(category && { category }),
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
  });

  const enriched = certs.map((c) => ({
    ...c,
    status: certStatus(c.expiryDate),
  }));

  return NextResponse.json({ certifications: enriched });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const body = await req.json();
  const { employeeId, title, issuer, category, issuedDate, expiryDate, documentUrl, notes } = body;

  if (!employeeId || !title) {
    return NextResponse.json({ error: "employeeId and title required" }, { status: 400 });
  }

  const cert = await prisma.trainingCertification.create({
    data: {
      businessId,
      employeeId,
      title,
      issuer: issuer ?? null,
      category: category ?? "OTHER",
      issuedDate: issuedDate ? new Date(issuedDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      documentUrl: documentUrl ?? null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json({ certification: { ...cert, status: certStatus(cert.expiryDate) } }, { status: 201 });
}
