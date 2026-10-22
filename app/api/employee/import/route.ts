export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { computeAccess, ROTA_STAFF_CAP } from "@/lib/billing/access";
import { parseStaffCsv } from "@/lib/activation/staff-csv";
import { logActivity } from "@/lib/services/activity.service";

/**
 * POST /api/employee/import — add staff from a CSV.
 *
 * Body: { csv: string, dryRun?: boolean }
 *
 * dryRun (the default) validates every row against the database and reports
 * what would happen, writing nothing. The UI always shows that preview first.
 * A real run creates only the rows marked "ready"; it never updates or removes
 * existing staff, and it sends no invites — inviting is a separate, explicit
 * step from the setup checklist or the employee list.
 */

type RowStatus = "ready" | "exists" | "invalid" | "over_cap" | "created" | "failed";

export async function POST(req: NextRequest) {
  const session = await requireRole("ADMIN", "MANAGER");
  if (isResponse(session)) return session;
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });

  let body: { csv?: unknown; dryRun?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const csv = typeof body.csv === "string" ? body.csv : "";
  const dryRun = body.dryRun !== false;
  if (!csv.trim()) return NextResponse.json({ error: "Paste or upload a CSV first." }, { status: 400 });
  if (csv.length > 500_000) return NextResponse.json({ error: "That file is too large (500 KB max)." }, { status: 413 });

  const parsed = parseStaffCsv(csv);
  if (parsed.fileErrors.length && parsed.rows.length === 0) {
    return NextResponse.json({ error: parsed.fileErrors.join(" "), fileErrors: parsed.fileErrors }, { status: 400 });
  }
  const blocking = parsed.fileErrors.filter((e) => !e.startsWith("Only the first"));
  if (blocking.length) {
    return NextResponse.json({ error: blocking.join(" "), fileErrors: parsed.fileErrors }, { status: 400 });
  }

  // Employee.email is unique across the whole platform, so an address used by
  // another venue is just as blocked as one already on this team.
  const emails = parsed.rows.map((r) => r.email).filter(Boolean);
  const existing = await prisma.employee.findMany({
    where: { email: { in: emails } },
    select: { email: true, businessId: true },
  });
  const existingBy = new Map(existing.map((e) => [e.email.toLowerCase(), e.businessId]));

  // Same staff ceiling as POST /api/employee/add — only bites on the free rota tier.
  let remaining = Infinity;
  try {
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { lsStatus: true, trialEndsAt: true, foundingMember: true },
    });
    const access = computeAccess({
      lsStatus: biz?.lsStatus,
      trialEndsAt: biz?.trialEndsAt,
      foundingMember: biz?.foundingMember,
    });
    if (access.mode === "rota") {
      const active = await prisma.employee.count({ where: { businessId, active: true } });
      remaining = Math.max(0, ROTA_STAFF_CAP - active);
    }
  } catch {
    // Fail open, as the single-add route does.
  }

  const departments = await prisma.department.findMany({
    where: { businessId },
    select: { id: true, name: true },
  });
  const deptBy = new Map(departments.map((d) => [d.name.trim().toLowerCase(), d.id]));
  const newDepartments = new Set<string>();

  const results = parsed.rows.map((r): (typeof r) & { status: RowStatus; message: string } => {
    let status: RowStatus = "ready";
    let message = "";
    if (r.errors.length) {
      status = "invalid";
      message = r.errors.join("; ");
    } else if (existingBy.has(r.email)) {
      status = "exists";
      message = existingBy.get(r.email) === businessId ? "already on your team" : "email already used on another Rotahr account";
    }
    if (status === "ready" && r.department && !deptBy.has(r.department.toLowerCase())) {
      newDepartments.add(r.department);
    }
    return { ...r, status, message };
  });

  let readyCount = 0;
  for (const r of results) {
    if (r.status !== "ready") continue;
    if (readyCount >= remaining) {
      r.status = "over_cap";
      r.message = `the free rota tier covers ${ROTA_STAFF_CAP} active staff`;
      continue;
    }
    readyCount++;
  }

  if (!dryRun) {
    for (const name of newDepartments) {
      const d = await prisma.department.create({ data: { businessId, name } });
      deptBy.set(name.toLowerCase(), d.id);
    }
    for (const r of results) {
      if (r.status !== "ready") continue;
      try {
        await prisma.employee.create({
          data: {
            businessId,
            firstName: r.firstName,
            lastName: r.lastName,
            email: r.email,
            phone: r.phone ?? null,
            role: r.role || "staff",
            hourlyRate: r.hourlyRate ?? null,
            departmentId: r.department ? deptBy.get(r.department.toLowerCase()) ?? null : null,
          },
        });
        r.status = "created";
      } catch (e: unknown) {
        // A unique violation here means someone else took the address between
        // preview and import; anything else is reported as-is.
        const code = (e as { code?: string })?.code;
        r.status = code === "P2002" ? "exists" : "failed";
        r.message = code === "P2002" ? "email already in use" : "could not be saved";
      }
    }
    const created = results.filter((r) => r.status === "created").length;
    if (created > 0) {
      logActivity({
        businessId,
        userId: session.user.id,
        userName: session.user.name ?? session.user.email,
        action: "employee_added",
        details: { source: "csv_import", count: created },
      }).catch(() => {});
    }
  }

  const summary: Record<RowStatus, number> = { ready: 0, exists: 0, invalid: 0, over_cap: 0, created: 0, failed: 0 };
  for (const r of results) summary[r.status]++;

  return NextResponse.json({
    dryRun,
    summary,
    newDepartments: [...newDepartments],
    fileErrors: parsed.fileErrors,
    rows: results.map(({ errors: _e, ...r }) => r),
  });
}
