import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  if (!employeeId) return NextResponse.json({ error: "employeeId required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  // Managers see all; staff see only their own
  const isManager = user.role === "MANAGER" || user.role === "ADMIN";
  if (!isManager) {
    // Check the employee belongs to this user
    const emp = await prisma.employee.findFirst({ where: { id: employeeId, userId: user.id } });
    if (!emp) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const docs = await prisma.employeeDocument.findMany({
    where: { employeeId, businessId: user.businessId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents: docs });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.businessId) return NextResponse.json({ error: "No business" }, { status: 400 });
  const isManager = user.role === "MANAGER" || user.role === "ADMIN";
  if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { employeeId, title, category, fileUrl, fileName, fileSize } = body;
  if (!employeeId || !title || !fileUrl || !fileName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const doc = await prisma.employeeDocument.create({
    data: {
      businessId: user.businessId,
      employeeId,
      title,
      category: category ?? "OTHER",
      fileUrl,
      fileName,
      fileSize: fileSize ?? null,
      uploadedById: user.id,
    },
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}
