// @ts-nocheck
import { prisma } from "@/lib/db";
import { z } from "zod";

export const createReservationSchema = z.object({
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().max(30).optional(),
  customerEmail: z.string().email().optional(),
  partySize: z.number().int().min(1).max(100),
  date: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date"),
  time: z.string().min(1, "Time is required"),
  notes: z.string().max(1000).optional(),
  dietary: z.string().max(500).optional(),
  occasion: z.string().max(100).optional(),
  tableId: z.string().optional(),
  kitchenNotes: z.string().optional(),
  upsellNotes: z.string().optional(),
  aiWarnings: z.string().optional(),
  aiTranscript: z.string().optional(),
});

export const updateReservationSchema = createReservationSchema.partial().extend({
  status: z.enum(["confirmed", "cancelled", "pending", "seated", "completed", "no_show"]).optional(),
});

export const reservationService = {
  async create(
    data: z.infer<typeof createReservationSchema>,
    businessId: string,
    createdById?: string
  ) {
    return prisma.reservation.create({
      data: {
        businessId,
        createdById: createdById ?? null,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        partySize: data.partySize,
        date: new Date(data.date),
        time: data.time,
        notes: data.notes,
        dietary: data.dietary,
        occasion: data.occasion,
        tableId: data.tableId ?? null,
        kitchenNotes: data.kitchenNotes,
        upsellNotes: data.upsellNotes,
        aiWarnings: data.aiWarnings,
        aiTranscript: data.aiTranscript,
      },
      include: {
        table: true,
      },
    });
  },

  async list(businessId: string, filters?: { date?: string; status?: string }) {
    return prisma.reservation.findMany({
      where: {
        businessId,
        ...(filters?.date
          ? {
              date: {
                gte: new Date(new Date(filters.date).setHours(0, 0, 0, 0)),
                lte: new Date(new Date(filters.date).setHours(23, 59, 59, 999)),
              },
            }
          : {}),
        ...(filters?.status ? { status: filters.status as any } : {}),
      },
      include: {
        table: { select: { id: true, name: true, capacity: true } },
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });
  },

  async getById(id: string, businessId: string) {
    return prisma.reservation.findFirst({
      where: { id, businessId },
      include: {
        table: true,
      },
    });
  },

  async update(
    id: string,
    businessId: string,
    data: z.infer<typeof updateReservationSchema>
  ) {
    const existing = await prisma.reservation.findFirst({ where: { id, businessId } });
    if (!existing) throw new Error("Reservation not found");

    return prisma.reservation.update({
      where: { id },
      data: {
        ...(data.customerName !== undefined ? { customerName: data.customerName } : {}),
        ...(data.customerPhone !== undefined ? { customerPhone: data.customerPhone } : {}),
        ...(data.customerEmail !== undefined ? { customerEmail: data.customerEmail } : {}),
        ...(data.partySize !== undefined ? { partySize: data.partySize } : {}),
        ...(data.date !== undefined ? { date: new Date(data.date) } : {}),
        ...(data.time !== undefined ? { time: data.time } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.dietary !== undefined ? { dietary: data.dietary } : {}),
        ...(data.occasion !== undefined ? { occasion: data.occasion } : {}),
        ...(data.tableId !== undefined ? { tableId: data.tableId } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.kitchenNotes !== undefined ? { kitchenNotes: data.kitchenNotes } : {}),
        ...(data.upsellNotes !== undefined ? { upsellNotes: data.upsellNotes } : {}),
      },
      include: { table: true },
    });
  },

  async delete(id: string, businessId: string) {
    const existing = await prisma.reservation.findFirst({ where: { id, businessId } });
    if (!existing) throw new Error("Reservation not found");
    return prisma.reservation.delete({ where: { id } });
  },
};
