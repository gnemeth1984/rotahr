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
    // time is stored as "HH:MM" string — filter by date, do time window in JS
    const dayStart = new Date(dateTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateTime);
    dayEnd.setHours(23, 59, 59, 999);

    const requestedMins = dateTime.getHours() * 60 + dateTime.getMinutes();

    const tables = await prisma.table.findMany({
      where: {
        businessId,
        capacity: { gte: partySize },
      },
      include: {
        reservations: {
          where: {
            status: { in: ["CONFIRMED", "SEATED"] },
            date: { gte: dayStart, lte: dayEnd },
          },
        },
      },
      orderBy: { capacity: "asc" },
    });

    return tables.filter((t) => {
      // Check no existing reservation is within ±2 hours
      return t.reservations.every((r) => {
        const [h, m] = (r.time as string).split(":").map(Number);
        const rMins = h * 60 + m;
        return Math.abs(rMins - requestedMins) > 120;
      });
    });
  },
};
