// @ts-nocheck
import { prisma } from "@/lib/db";
import { z } from "zod";

export const addEmployeeSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.string().default("staff"),
  departmentId: z.string().optional(),
  businessId: z.string().min(1),
  hourlyRate: z.number().optional(),
  contractType: z.string().optional(),
  startDate: z.string().optional(),
});

export const GRANTABLE_PERMISSIONS = [
  { key: "bookkeeping", label: "Bookkeeping" },
  { key: "stocktaking", label: "Stock & Orders" },
  { key: "payroll", label: "Payroll" },
  { key: "tips", label: "Tips & Tronc" },
  { key: "bookings", label: "Bookings (manage)" },
  { key: "training", label: "Training & Certs (all staff)" },
  { key: "reports", label: "Dashboard reports" },
  { key: "copilot", label: "Manager Copilot" },
] as const;

export type GrantablePermission = typeof GRANTABLE_PERMISSIONS[number]["key"];

export const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  role: z.string().optional(),
  departmentId: z.string().nullable().optional(),
  active: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
  hourlyRate: z.number().nullable().optional(),
  // HR / Payroll
  startDate: z.string().nullable().optional(),
  contractType: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  // nationality intentionally excluded — GDPR Art. 9 special category, no right-to-work workflow
  ppsn: z.string().nullable().optional(),
  bankIban: z.string().nullable().optional(),
  bankBic: z.string().nullable().optional(),
  emergencyName: z.string().nullable().optional(),
  emergencyPhone: z.string().nullable().optional(),
  emergencyRel: z.string().nullable().optional(),
});

/**
 * "none"    – no login (never invited)
 * "invited" – User exists but has never set a password or signed in
 * "active"  – has a password or has signed in (e.g. via Google)
 */
export type AccountStatus = "none" | "invited" | "active";
export function accountStatusOf(
  userId: string | null,
  user: { password: string | null; lastLoginAt: Date | null } | null
): AccountStatus {
  if (!userId || !user) return "none";
  return user.password || user.lastLoginAt ? "active" : "invited";
}

/**
 * The fields any member of the business may see about a colleague. Contact
 * details, pay, permissions and login status are manager-only — except on the
 * caller's own row.
 */
export function toDirectoryEntry<
  T extends {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    active: boolean;
    userId: string | null;
    departmentId: string | null;
    venueId?: string | null;
    department?: { id: string; name: string } | null;
    email?: string;
    phone?: string | null;
  }
>(e: T, viewerUserId: string) {
  const self = !!e.userId && e.userId === viewerUserId;
  return {
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    role: e.role,
    active: e.active,
    departmentId: e.departmentId,
    venueId: e.venueId ?? null,
    department: e.department ?? null,
    isSelf: self,
    ...(self ? { email: e.email, phone: e.phone ?? null } : {}),
  };
}

export const employeeService = {
  async add(data: z.infer<typeof addEmployeeSchema>) {
    const exists = await prisma.employee.findUnique({ where: { email: data.email } });
    if (exists) throw new Error("Employee email already in use");

    return prisma.employee.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone ?? null,
        role: data.role,
        businessId: data.businessId,
        departmentId: data.departmentId ?? null,
        hourlyRate: data.hourlyRate ?? null,
        contractType: data.contractType ?? null,
        startDate: data.startDate ? new Date(data.startDate) : null,
      },
      include: { department: true },
    });
  },

  async list(businessId: string, departmentId?: string) {
    // NOTE: Never include ppsn, bankIban, bankBic, address, emergencyName/Phone/Rel
    // in list results — these are only returned by getById (manager/admin only route).
    const rows = await prisma.employee.findMany({
      where: {
        businessId,
        ...(departmentId ? { departmentId } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        hourlyRate: true,
        startDate: true,
        contractType: true,
        permissions: true,
        userId: true,
        departmentId: true,
        venueId: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { id: true, name: true } },
        _count: { select: { shifts: true } },
        // Only used to derive accountStatus below; stripped before returning.
        user: { select: { password: true, lastLoginAt: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return rows.map(({ user, ...e }) => ({ ...e, accountStatus: accountStatusOf(e.userId, user) }));
  },

  async getById(id: string, businessId: string) {
    // Full record — only called by manager/admin routes
    const row = await prisma.employee.findFirst({
      where: { id, businessId },
      include: {
        department: true,
        shifts: { orderBy: { date: "asc" }, take: 20 },
        timeOffRequests: { orderBy: { createdAt: "desc" }, take: 10 },
        user: { select: { password: true, lastLoginAt: true } },
      },
    });
    if (!row) return row;
    const { user, ...e } = row;
    return { ...e, accountStatus: accountStatusOf(e.userId, user) };
  },

  async update(id: string, businessId: string, data: z.infer<typeof updateEmployeeSchema>) {
    const employee = await prisma.employee.findFirst({ where: { id, businessId } });
    if (!employee) throw new Error("Employee not found");
    const { startDate, ...rest } = data;
    return prisma.employee.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate !== undefined
          ? { startDate: startDate ? new Date(startDate) : null }
          : {}),
      },
    });
  },
};
