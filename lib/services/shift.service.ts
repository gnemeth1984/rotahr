import { prisma } from "@/lib/db";
import { z } from "zod";

export const createShiftSchema = z.object({
  employeeId: z.string().cuid(),
  businessId: z.string().cuid(),
  date: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date"),
  startTime: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid startTime"),
  endTime: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid endTime"),
  role: z.string().default("staff"),
  published: z.boolean().default(false),
});

export const updateShiftSchema = z.object({
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  role: z.string().optional(),
  published: z.boolean().optional(),
});

export const shiftService = {
  async create(data: z.infer<typeof createShiftSchema>, businessId: string) {
    // Verify employee belongs to business
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, businessId },
    });
    if (!employee) throw new Error("Employee not found in this business");

    return prisma.shift.create({
      data: {
        employeeId: data.employeeId,
        businessId,
        date: new Date(data.date),
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        role: data.role,
        published: data.published,
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });
  },

  async list(businessId: string, filters?: { employeeId?: string; from?: string; to?: string; published?: boolean }) {
    return prisma.shift.findMany({
      where: {
        businessId,
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
          select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
  },

  async update(id: string, businessId: string, data: z.infer<typeof updateShiftSchema>) {
    const shift = await prisma.shift.findFirst({ where: { id, businessId } });
    if (!shift) throw new Error("Shift not found");

    return prisma.shift.update({
      where: { id },
      data: {
        ...(data.date ? { date: new Date(data.date) } : {}),
        ...(data.startTime ? { startTime: new Date(data.startTime) } : {}),
        ...(data.endTime ? { endTime: new Date(data.endTime) } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.published !== undefined ? { published: data.published } : {}),
      },
    });
  },
};
