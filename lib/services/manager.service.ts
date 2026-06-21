// @ts-nocheck
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { triggerWelcomeEmail } from "@/lib/email/marketing";

export const addManagerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  businessId: z.string().cuid(),
});

export const managerService = {
  async add(data: z.infer<typeof addManagerSchema>) {
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) throw new Error("Email already in use");

    const hashed = await bcrypt.hash(data.password, 12);
    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        role: "MANAGER",
        businessId: data.businessId,
      },
      select: { id: true, name: true, email: true, role: true, businessId: true, createdAt: true },
    });

    // Fire-and-forget welcome email — never blocks the invite flow
    const firstName = data.name?.split(" ")[0] ?? undefined;
    triggerWelcomeEmail({ first_name: firstName, email: data.email });

    return newUser;
  },

  async list(businessId: string) {
    return prisma.user.findMany({
      where: { businessId, role: { in: ["MANAGER", "ADMIN"] } },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  },
};
