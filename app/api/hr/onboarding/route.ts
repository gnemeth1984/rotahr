import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

const DEFAULT_TASKS = [
  { title: "Sign employment contract", description: "Upload signed contract document", sortOrder: 0 },
  { title: "Provide proof of ID", description: "Passport or driving licence copy", sortOrder: 1 },
  { title: "Complete HACCP / Food Safety training", description: "Required for all food-handling staff", sortOrder: 2 },
  { title: "Read staff handbook", description: "Confirm receipt and understanding of policies", sortOrder: 3 },
  { title: "Set up bank details for payroll", description: "Provide IBAN for salary payments", sortOrder: 4 },
  { title: "Complete tax registration (Revenue)", description: "Submit TRS form or myAccount registration", sortOrder: 5 },
];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  if (!employeeId) return NextResponse.json({ error: "employeeId required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  let tasks = await prisma.onboardingTask.findMany({
    where: { employeeId, businessId: user.businessId },
    orderBy: { sortOrder: "asc" },
  });

  // Auto-seed default tasks if none exist yet
  if (tasks.length === 0) {
    await prisma.onboardingTask.createMany({
      data: DEFAULT_TASKS.map((t) => ({
        ...t,
        businessId: user.businessId!,
        employeeId,
      })),
    });
    tasks = await prisma.onboardingTask.findMany({
      where: { employeeId, businessId: user.businessId },
      orderBy: { sortOrder: "asc" },
    });
  }

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.businessId) return NextResponse.json({ error: "No business" }, { status: 400 });
  const isManager = user.role === "MANAGER" || user.role === "ADMIN";
  if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { employeeId, title, description, dueDate } = body;
  if (!employeeId || !title) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const task = await prisma.onboardingTask.create({
    data: {
      businessId: user.businessId,
      employeeId,
      title,
      description: description ?? null,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
