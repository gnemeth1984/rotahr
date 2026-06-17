// @ts-nocheck
import { prisma } from "@/lib/db";
import { z } from "zod";

export const timeOffRequestSchema = z.object({
  employeeId: z.string().cuid(),
  startDate: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid startDate"),
  endDate: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid endDate"),
  reason: z.string().max(500).optional(),
});

export const timeOffService = {
  async request(data: z.infer<typeof timeOffRequestSchema>, businessId: string) {
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, businessId },
    });
    if (!employee) throw new Error("Employee not found in this business");

    return prisma.timeOffRequest.create({
      data: {
        employeeId: data.employeeId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
        status: "PENDING",
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });
  },

  async pending(businessId: string) {
    return prisma.timeOffRequest.findMany({
      where: {
        status: "PENDING",
        employee: { businessId },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async updateStatus(id: string, businessId: string, status: "APPROVED" | "REJECTED") {
    const req = await prisma.timeOffRequest.findFirst({
      where: { id, employee: { businessId } },
    });
    if (!req) throw new Error("Request not found");

    return prisma.timeOffRequest.update({
      where: { id },
      data: { status },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });
  },
};
