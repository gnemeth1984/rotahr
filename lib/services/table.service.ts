// @ts-nocheck
import { prisma } from "@/lib/db";
import { z } from "zod";

export const createTableSchema = z.object({
  name: z.string().min(1).max(50),
  capacity: z.number().int().min(1).max(50),
  location: z.string().max(100).optional(),
  shape: z.enum(["square", "circle", "rect"]).optional(),
});

export const updateTableSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  location: z.string().max(100).optional().nullable(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  width: z.number().min(40).max(400).optional(),
  height: z.number().min(40).max(400).optional(),
  shape: z.enum(["square", "circle", "rect"]).optional(),
});

export const tableService = {
  async create(data: z.infer<typeof createTableSchema>, businessId: string) {
    // Stagger new tables so they don't all stack at the same spot
    const count = await prisma.table.count({ where: { businessId } });
    const col = count % 6;
    const row = Math.floor(count / 6);
    return prisma.table.create({
      data: {
        ...data,
        businessId,
        posX: 40 + col * 110,
        posY: 40 + row * 110,
      },
    });
  },

  async update(id: string, businessId: string, data: z.infer<typeof updateTableSchema>) {
    const existing = await prisma.table.findFirst({ where: { id, businessId } });
    if (!existing) return null;
    return prisma.table.update({ where: { id }, data });
  },

  async remove(id: string, businessId: string) {
    const existing = await prisma.table.findFirst({ where: { id, businessId } });
    if (!existing) return null;
    return prisma.table.delete({ where: { id } });
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
            status: { in: ["confirmed", "seated"] },
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
