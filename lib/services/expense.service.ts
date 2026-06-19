// @ts-nocheck
import { prisma } from "@/lib/db";
import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  { value: "wages", label: "Staff Wages & Overtime" },
  { value: "supplier", label: "Supplier Invoices" },
  { value: "food_beverage", label: "Food & Beverage Stock" },
  { value: "utilities", label: "Utilities" },
  { value: "equipment", label: "Equipment & Maintenance" },
  { value: "general", label: "General Business" },
] as const;

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "direct_debit", label: "Direct Debit" },
] as const;

export const createExpenseSchema = z.object({
  businessId: z.string().min(1),
  amount: z.number().positive(),
  vatAmount: z.number().min(0).default(0),
  currency: z.string().default("EUR"),
  vendor: z.string().optional(),
  category: z.string().min(1),
  date: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date"),
  description: z.string().optional(),
  paymentMethod: z.string().optional(),
  status: z.string().default("confirmed"),
  receiptUrl: z.string().optional(),
  receiptDataUrl: z.string().optional(),   // base64 data URI — 30-day recall
  receiptExpiresAt: z.string().optional(), // ISO date string
  aiRawText: z.string().optional(),
  employeeId: z.string().optional(),
  createdById: z.string().optional(),
});

export const updateExpenseSchema = createExpenseSchema
  .omit({ businessId: true })
  .partial();

export const expenseService = {
  async create(data: z.infer<typeof createExpenseSchema>) {
    return prisma.expense.create({
      data: {
        businessId: data.businessId,
        amount: data.amount,
        vatAmount: data.vatAmount ?? 0,
        currency: data.currency ?? "EUR",
        vendor: data.vendor ?? null,
        category: data.category,
        date: new Date(data.date),
        description: data.description ?? null,
        paymentMethod: data.paymentMethod ?? null,
        status: data.status ?? "confirmed",
        receiptUrl: data.receiptUrl ?? null,
        receiptDataUrl: data.receiptDataUrl ?? null,
        receiptExpiresAt: data.receiptExpiresAt ? new Date(data.receiptExpiresAt) : null,
        aiRawText: data.aiRawText ?? null,
        employeeId: data.employeeId ?? null,
        createdById: data.createdById ?? null,
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });
  },

  async list(
    businessId: string,
    filters?: {
      from?: string;
      to?: string;
      category?: string;
      status?: string;
    }
  ) {
    return prisma.expense.findMany({
      where: {
        businessId,
        ...(filters?.category ? { category: filters.category } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.from || filters?.to
          ? {
              date: {
                // Use UTC boundaries — client sends UTC ISO strings
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to
                  ? { lte: new Date(filters.to.replace(/T\d{2}:\d{2}:\d{2}/, "T23:59:59")) }
                  : {}),
              },
            }
          : {}),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { date: "desc" },
    });
  },

  async getById(id: string, businessId: string) {
    return prisma.expense.findFirst({
      where: { id, businessId },
      include: { employee: true },
    });
  },

  async update(id: string, businessId: string, data: z.infer<typeof updateExpenseSchema>) {
    const expense = await prisma.expense.findFirst({ where: { id, businessId } });
    if (!expense) throw new Error("Expense not found");
    return prisma.expense.update({
      where: { id },
      data: {
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.vatAmount !== undefined ? { vatAmount: data.vatAmount } : {}),
        ...(data.vendor !== undefined ? { vendor: data.vendor } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.date !== undefined ? { date: new Date(data.date) } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.paymentMethod !== undefined ? { paymentMethod: data.paymentMethod } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.receiptUrl !== undefined ? { receiptUrl: data.receiptUrl } : {}),
        ...(data.receiptDataUrl !== undefined ? { receiptDataUrl: data.receiptDataUrl } : {}),
        ...(data.receiptExpiresAt !== undefined ? { receiptExpiresAt: data.receiptExpiresAt ? new Date(data.receiptExpiresAt) : null } : {}),
        ...(data.aiRawText !== undefined ? { aiRawText: data.aiRawText } : {}),
        ...(data.employeeId !== undefined ? { employeeId: data.employeeId } : {}),
      },
    });
  },

  async delete(id: string, businessId: string) {
    const expense = await prisma.expense.findFirst({ where: { id, businessId } });
    if (!expense) throw new Error("Expense not found");
    return prisma.expense.delete({ where: { id } });
  },

  async summary(businessId: string, from: string, to: string) {
    const expenses = await prisma.expense.findMany({
      where: {
        businessId,
        status: "confirmed",
        date: {
          gte: new Date(from),
          lte: new Date(to.replace(/T\d{2}:\d{2}:\d{2}/, "T23:59:59")),
        },
      },
    });

    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const totalVat = expenses.reduce((s, e) => s + e.vatAmount, 0);

    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    }

    return { total, totalVat, byCategory, count: expenses.length };
  },
};
