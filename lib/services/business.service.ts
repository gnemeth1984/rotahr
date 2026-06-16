// @ts-nocheck
import { prisma } from "@/lib/db";
import { z } from "zod";

export const createBusinessSchema = z.object({
  name: z.string().min(1).max(100),
});

export const businessService = {
  async create(name: string, adminId: string) {
    return prisma.business.create({
      data: {
        name,
        managers: { connect: { id: adminId } },
      },
      include: { managers: true },
    });
  },

  async getById(id: string) {
    return prisma.business.findUnique({
      where: { id },
      include: {
        managers: { select: { id: true, name: true, email: true, role: true } },
        departments: true,
        _count: { select: { employees: true, shifts: true } },
      },
    });
  },
};
