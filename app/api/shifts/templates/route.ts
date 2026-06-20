// @ts-nocheck
// Named rota templates — save current week as a named template, list templates, apply
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// GET /api/shifts/templates — list distinct template names
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ templates: [] });

  const templates = await prisma.shiftTemplate.findMany({
    where: { businessId, active: true, templateName: { not: null } },
    distinct: ["templateName"],
    select: { templateName: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ templates: templates.map((t) => t.templateName) });
}

// POST /api/shifts/templates — save week as named template
// body: { templateName, monday, keepAssignments }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const { templateName, monday, keepAssignments = false } = await req.json();
  if (!templateName || !monday) {
    return NextResponse.json({ error: "templateName and monday required" }, { status: 400 });
  }

  const from = new Date(monday);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  to.setHours(23, 59, 59, 999);

  const bizEmployees = await prisma.employee.findMany({
    where: { businessId },
    select: { id: true },
  });
  const empIds = new Set(bizEmployees.map((e) => e.id));

  const shifts = await prisma.shift.findMany({
    where: {
      employeeId: { in: Array.from(empIds) },
      date: { gte: from, lte: to },
    },
  });

  if (shifts.length === 0) {
    return NextResponse.json({ error: "No shifts in source week", saved: 0 }, { status: 404 });
  }

  // Delete existing template with same name
  await prisma.shiftTemplate.deleteMany({ where: { businessId, templateName } });

  // Save as template (dayOfWeek 0=Mon...6=Sun in template context)
  const templates = shifts.map((s) => {
    const dayOfWeek = new Date(s.date).getDay(); // 0=Sun, 1=Mon, etc
    const startTime = new Date(s.startTime);
    const endTime = new Date(s.endTime);
    return {
      businessId,
      employeeId: keepAssignments ? (s.employeeId ?? null) : null,
      dayOfWeek,
      startHour: startTime.getHours(),
      startMinute: startTime.getMinutes(),
      endHour: endTime.getHours(),
      endMinute: endTime.getMinutes(),
      role: s.role ?? null,
      templateName,
      venueId: s.venueId ?? null,
    };
  });

  await prisma.shiftTemplate.createMany({ data: templates });

  return NextResponse.json({ saved: templates.length, templateName });
}
