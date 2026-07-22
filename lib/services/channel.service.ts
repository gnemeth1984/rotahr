// @ts-nocheck
import { prisma } from "@/lib/db";

/**
 * Ensures every business has an "Everyone" channel plus one channel per
 * existing department. Idempotent — safe to call on every GET /api/channels.
 * Membership is never stored separately; it's derived live from
 * Employee.departmentId so staff moving departments "just works".
 */
export async function ensureChannels(businessId: string) {
  const [everyone, departments] = await Promise.all([
    prisma.messageChannel.findFirst({ where: { businessId, departmentId: null } }),
    prisma.department.findMany({ where: { businessId }, select: { id: true, name: true } }),
  ]);

  if (!everyone) {
    await prisma.messageChannel.create({ data: { businessId, departmentId: null, name: "Everyone" } });
  }

  const existingDeptChannels = await prisma.messageChannel.findMany({
    where: { businessId, departmentId: { in: departments.map((d) => d.id) } },
    select: { departmentId: true },
  });
  const existingIds = new Set(existingDeptChannels.map((c) => c.departmentId));

  const missing = departments.filter((d) => !existingIds.has(d.id));
  if (missing.length > 0) {
    await prisma.$transaction(
      missing.map((d) =>
        prisma.messageChannel.create({ data: { businessId, departmentId: d.id, name: d.name } })
      )
    );
  }
}

/** Current members of a channel: everyone active in that department, or the whole business for "Everyone". */
export async function getChannelMembers(channel: { businessId: string; departmentId: string | null }) {
  return prisma.employee.findMany({
    where: {
      businessId: channel.businessId,
      active: true,
      ...(channel.departmentId ? { departmentId: channel.departmentId } : {}),
    },
    select: { id: true, firstName: true, lastName: true, userId: true },
  });
}
