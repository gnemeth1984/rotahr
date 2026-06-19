// @ts-nocheck
import { prisma } from "@/lib/db";
import { z } from "zod";

export const createShiftSchema = z.object({
  employeeId: z.string().optional(),
  date: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date"),
  startTime: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid startTime"),
  endTime: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid endTime"),
  role: z.string().optional(),
  published: z.boolean().default(false),
  overtimeHours: z.number().min(0).default(0),
});

export const updateShiftSchema = z.object({
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  role: z.string().optional(),
  published: z.boolean().optional(),
  overtimeHours: z.number().min(0).optional(),
});

export const shiftService = {
  async create(data: z.infer<typeof createShiftSchema>) {
    return prisma.shift.create({
      data: {
        ...(data.employeeId ? { employeeId: data.employeeId } : {}),
        date: new Date(data.date),
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        role: data.role ?? null,
        published: data.published,
        overtimeHours: data.overtimeHours ?? 0,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  },

  async list(_businessId: string, filters?: { employeeId?: string; from?: string; to?: string; published?: boolean }) {
    return prisma.shift.findMany({
      where: {
        ...(filters?.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters?.published !== undefined ? { published: filters.published } : {}),
        ...(filters?.from || filters?.to
          ? {
              date: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
  },

  async update(id: string, _businessId: string, data: z.infer<typeof updateShiftSchema>) {
    const shift = await prisma.shift.findFirst({ where: { id } });
    if (!shift) throw new Error("Shift not found");

    return prisma.shift.update({
      where: { id },
      data: {
        ...(data.date ? { date: new Date(data.date) } : {}),
        ...(data.startTime ? { startTime: new Date(data.startTime) } : {}),
        ...(data.endTime ? { endTime: new Date(data.endTime) } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.published !== undefined ? { published: data.published } : {}),
        ...(data.overtimeHours !== undefined ? { overtimeHours: data.overtimeHours } : {}),
      },
    });
  },

  async delete(id: string) {
    const shift = await prisma.shift.findFirst({ where: { id } });
    if (!shift) throw new Error("Shift not found");
    return prisma.shift.delete({ where: { id } });
  },
};
