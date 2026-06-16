import { z } from "zod";

export const createBookingSchema = z.object({
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  title: z.string().optional().default("Shift"),
  notes: z.string().optional(),
  userId: z.string().optional(),
});

export const updateBookingSchema = createBookingSchema.partial().extend({
  status: z.enum(["CONFIRMED", "CANCELLED", "PENDING"]).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
