// @ts-nocheck
import { prisma } from "@/lib/db";
import { z } from "zod";

export const createTableSchema = z.object({
  name: z.string().min(1).max(50),
  capacity: z.number().int().min(1).max(50),
  location: z.string().max(100).optional(),
});

export const tableService = {
  async create(data: z.infer<typeof createTableSchema>, businessId: string) {
    return prisma.table.create({
      data: { ...data, businessId },
    });
  },

  async list(businessId: string) {
    return prisma.table.findMany({
      where: { businessId },
      include: { _count: { select: { reservations: true } } },
      orderBy: { name: "asc" },
    });
  },

  /**
   * Find an available table for partySize on a given date/time window.
   * A table is considered occupied if it has a CONFIRMED reservation
   * within ±2 hours of the requested time.
   */
  async findAvailable(businessId: string, partySize: number, dateTime: Date) {
    const windowStart = new Date(dateTime.getTime() - 2 * 60 * 60 * 1000);
    const windowEnd = new Date(dateTime.getTime() + 2 * 60 * 60 * 1000);

    const tables = await prisma.table.findMany({
      where: {
        businessId,
        capacity: { gte: partySize },
      },
      include: {
        reservations: {
          where: {
            status: { in: ["CONFIRMED", "SEATED"] },
            time: { gte: windowStart, lte: windowEnd },
          },
        },
      },
      orderBy: { capacity: "asc" }, // prefer smallest fitting table
    });

    return tables.filter((t) => t.reservations.length === 0);
  },
};
