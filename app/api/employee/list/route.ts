// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isResponse } from "@/lib/auth/middleware";
import { employeeService, toDirectoryEntry } from "@/lib/services/employee.service";

/**
 * Team list.
 *
 * Every signed-in member of the business can call this — the rota, bookings
 * "notify staff" sheet and team page all need names. Only ADMIN / MANAGER get
 * the full record (contact details, pay rate, permissions, login status).
 * Everyone else gets the directory view: name, role, department, venue. Their
 * own row is the exception — you can always see your own contact details.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (isResponse(session)) return session;

  if (!session.user.businessId) {
    return NextResponse.json({ error: "No business associated" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId") ?? undefined;

  const employees = await employeeService.list(session.user.businessId, departmentId);

  const isManager = session.user.role === "ADMIN" || session.user.role === "MANAGER";
  if (isManager) return NextResponse.json({ employees });

  return NextResponse.json({
    employees: employees.map((e) => toDirectoryEntry(e, session.user.id)),
  });
}
