import { z } from "zod";

export const createTimeOffSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().optional(),
});

export const updateTimeOffSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  managedById: z.string().optional(),
});

export type CreateTimeOffInput = z.infer<typeof createTimeOffSchema>;
export type UpdateTimeOffInput = z.infer<typeof updateTimeOffSchema>;
