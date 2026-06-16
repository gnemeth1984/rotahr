import { prisma } from "@/lib/db";
import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  businessId: z.string().cuid(),
});

export const departmentService = {
  async create(name: string, businessId: string) {
    return prisma.department.create({
      data: { name, businessId },
    });
  },

  async list(businessId: string) {
    return prisma.department.findMany({
      where: { businessId },
      include: {
        _count: { select: { employees: true } },
      },
      orderBy: { name: "asc" },
    });
  },
};
