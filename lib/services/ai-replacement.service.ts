// @ts-nocheck
import { prisma } from "@/lib/db";
import { z } from "zod";

export const suggestReplacementSchema = z.object({
  timeOffRequestId: z.string().cuid(),
  businessId: z.string().cuid(),
});

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  score: number;
  reasons: string[];
  warnings: string[];
}

export async function suggestReplacements(
  timeOffRequestId: string,
  businessId: string
): Promise<{
  absentEmployee: { id: string; firstName: string; lastName: string };
  department: string | null;
  candidates: Candidate[];
  warnings: string[];
}> {
  // 1. Load the time-off request
  const request = await prisma.timeOffRequest.findFirst({
    where: { id: timeOffRequestId, employee: { businessId } },
    include: {
      employee: {
        include: { department: true },
      },
    },
  });

  if (!request) throw new Error("Time-off request not found");

  const absent = request.employee;
  const start = request.startDate;
  const end = request.endDate;
  const departmentId = absent.departmentId;
  const topLevelWarnings: string[] = [];

  // 2. Find all active employees in the same department (excluding absent)
  const departmentEmployees = await prisma.employee.findMany({
    where: {
      businessId,
      active: true,
      id: { not: absent.id },
      ...(departmentId ? { departmentId } : {}),
    },
    include: {
      shifts: {
        where: {
          date: { gte: start, lte: end },
        },
      },
      timeOffRequests: {
        where: {
          status: { in: ["PENDING", "APPROVED"] },
          startDate: { lte: end },
          endDate: { gte: start },
        },
      },
    },
  });

  if (departmentEmployees.length === 0) {
    topLevelWarnings.push("No other employees in this department — department will be understaffed.");
  }

  // 3. Score each candidate
  const scored: Candidate[] = [];

  for (const emp of departmentEmployees) {
    const reasons: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Already on time off during this period → skip
    if (emp.timeOffRequests.length > 0) continue;

    // Already scheduled → penalise (might still work with schedule change)
    const scheduledDays = emp.shifts.length;
    if (scheduledDays > 0) {
      score -= scheduledDays * 10;
      warnings.push(`Already has ${scheduledDays} shift(s) during this period`);
    }

    // Role match
    if (emp.role === absent.role) {
      score += 20;
      reasons.push(`Same role as absent employee (${emp.role})`);
    } else {
      score -= 10;
      warnings.push(`Different role — ${emp.role} vs required ${absent.role}`);
    }

    // Overtime risk: if > 5 shifts during period
    if (scheduledDays >= 5) {
      score -= 20;
      warnings.push("Overtime risk — already has 5+ shifts in this period");
    }

    reasons.push("Available (no time off during this period)");

    scored.push({
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      role: emp.role,
      score,
      reasons,
      warnings,
    });
  }

  // 4. Sort by score descending, return top 3
  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3);

  if (top3.length < 3) {
    topLevelWarnings.push(`Only ${top3.length} replacement candidate(s) found — department may be understaffed.`);
  }

  return {
    absentEmployee: { id: absent.id, firstName: absent.firstName, lastName: absent.lastName },
    department: absent.department?.name ?? null,
    candidates: top3,
    warnings: topLevelWarnings,
  };
}
