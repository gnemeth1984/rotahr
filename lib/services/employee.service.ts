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
});

export const GRANTABLE_PERMISSIONS = [
  { key: "bookkeeping", label: "Bookkeeping" },
  { key: "stocktaking", label: "Stock & Orders" },
  { key: "payroll", label: "Payroll" },
  { key: "tips", label: "Tips & Tronc" },
  { key: "bookings", label: "Bookings (manage)" },
  { key: "training", label: "Training & Certs (all staff)" },
  { key: "reports", label: "Dashboard reports" },
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
      },
      include: { department: true },
    });
  },

  async list(businessId: string, departmentId?: string) {
    // NOTE: Never include ppsn, bankIban, bankBic, address, emergencyName/Phone/Rel
    // in list results — these are only returned by getById (manager/admin only route).
    return prisma.employee.findMany({
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
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  },

  async getById(id: string, businessId: string) {
    // Full record — only called by manager/admin routes
    return prisma.employee.findFirst({
      where: { id, businessId },
      include: {
        department: true,
        shifts: { orderBy: { date: "asc" }, take: 20 },
        timeOffRequests: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
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
