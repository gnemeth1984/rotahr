// @ts-nocheck
import { prisma } from "@/lib/db";
import { z } from "zod";

export const addEmployeeSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  phone: z.string().optional(),
  ppsNumber: z.string().optional(),
  role: z.string().default("staff"),
  departmentId: z.string().optional(),
  businessId: z.string().min(1),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyRelation: z.string().optional(),
  // Medical
  medicalConditions: z.string().optional(),
  medications: z.string().optional(),
  bloodType: z.string().optional(),
  doctorName: z.string().optional(),
  doctorPhone: z.string().optional(),
  medicalNotes: z.string().optional(),
});

export const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  ppsNumber: z.string().nullable().optional(),
  role: z.string().optional(),
  departmentId: z.string().nullable().optional(),
  active: z.boolean().optional(),
  emergencyName: z.string().nullable().optional(),
  emergencyPhone: z.string().nullable().optional(),
  emergencyRelation: z.string().nullable().optional(),
  // Medical
  medicalConditions: z.string().nullable().optional(),
  medications: z.string().nullable().optional(),
  bloodType: z.string().nullable().optional(),
  doctorName: z.string().nullable().optional(),
  doctorPhone: z.string().nullable().optional(),
  medicalNotes: z.string().nullable().optional(),
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
        ppsNumber: data.ppsNumber ?? null,
        role: data.role,
        businessId: data.businessId,
        departmentId: data.departmentId ?? null,
        emergencyName: data.emergencyName ?? null,
        emergencyPhone: data.emergencyPhone ?? null,
        emergencyRelation: data.emergencyRelation ?? null,
        medicalConditions: data.medicalConditions ?? null,
        medications: data.medications ?? null,
        bloodType: data.bloodType ?? null,
        doctorName: data.doctorName ?? null,
        doctorPhone: data.doctorPhone ?? null,
        medicalNotes: data.medicalNotes ?? null,
      },
      include: { department: true },
    });
  },

  async list(businessId: string, departmentId?: string) {
    return prisma.employee.findMany({
      where: {
        businessId,
        ...(departmentId ? { departmentId } : {}),
      },
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { shifts: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  },

  async getById(id: string, businessId: string) {
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
    return prisma.employee.update({ where: { id }, data });
  },
};
