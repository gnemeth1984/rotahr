// @ts-nocheck
import { prisma } from "@/lib/db";
import { z } from "zod";

/** Start of the given calendar day, in UTC. */
function startOfDay(v: string) {
  const d = new Date(v);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** End of the given calendar day, in UTC — makes `to` filters inclusive. */
function endOfDay(v: string) {
  const d = new Date(v);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

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

  async list(businessId: string, filters?: { employeeId?: string; from?: string; to?: string; published?: boolean }) {
    // Shift has no direct businessId — resolve via employees
    let employeeIdFilter: string[] | undefined;
    if (filters?.employeeId) {
      employeeIdFilter = [filters.employeeId];
    } else if (businessId) {
      const bizEmployees = await prisma.employee.findMany({
        where: { businessId },
        select: { id: true },
      });
      employeeIdFilter = bizEmployees.map((e) => e.id);
    }

    return prisma.shift.findMany({
      where: {
        ...(employeeIdFilter ? { employeeId: { in: employeeIdFilter } } : {}),
        ...(filters?.published !== undefined ? { published: filters.published } : {}),
        ...(filters?.from || filters?.to
          ? {
              date: {
                ...(filters.from ? { gte: startOfDay(filters.from) } : {}),
                // `to` is an inclusive calendar day. Without this the range ends
                // at 00:00 on that day and every shift on it is silently dropped.
                ...(filters.to ? { lte: endOfDay(filters.to) } : {}),
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

  // Tenant isolation: businessId used to be accepted and ignored (`_businessId`),
  // so a manager could edit any business's shift by ID. Shift has no businessId
  // column — scope through the employee relation.
  async update(id: string, businessId: string, data: z.infer<typeof updateShiftSchema>) {
    const shift = await prisma.shift.findFirst({
      where: { id, employee: { businessId } },
    });
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

  // Tenant isolation: previously took no businessId at all, so any manager
  // could delete another business's shift by ID. Same relation-scoping as
  // `update` and `list`.
  async delete(id: string, businessId: string) {
    const shift = await prisma.shift.findFirst({
      where: { id, employee: { businessId } },
    });
    if (!shift) throw new Error("Shift not found");
    return prisma.shift.delete({ where: { id } });
  },
};
