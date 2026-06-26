// @ts-nocheck
// Daily cron: flag certifications expiring within 30 days
// Sends in-app notifications to managers
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/services/appNotification.service";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 86400000);

  // Find certs expiring in next 30 days or already expired (within last 7 days to avoid spam)
  const expiredSince = new Date(now.getTime() - 7 * 86400000);

  const certs = await prisma.trainingCertification.findMany({
    where: {
      expiryDate: {
        gte: expiredSince,
        lte: in30Days,
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          businessId: true,
        },
      },
    },
  });

  if (certs.length === 0) {
    return NextResponse.json({ checked: 0, alerts: 0 });
  }

  let alertCount = 0;

  for (const cert of certs) {
    if (!cert.employee) continue;
    const emp = cert.employee;

    const isExpired = cert.expiryDate < now;
    const daysUntilExpiry = Math.round((cert.expiryDate.getTime() - now.getTime()) / 86400000);

    // Check if we already alerted today for this cert
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const existing = await prisma.appNotification.findFirst({
      where: {
        type: "cert_expiry",
        referenceId: cert.id,
        createdAt: { gte: today },
      },
    });
    if (existing) continue;

    const managers = await prisma.user.findMany({
      where: {
        businessId: emp.businessId,
        role: { in: ["MANAGER", "ADMIN"] },
      },
      select: { id: true },
    });

    const empName = `${emp.firstName} ${emp.lastName}`;
    const title = isExpired
      ? `${empName}'s ${cert.title} has expired`
      : `${empName}'s ${cert.title} expiring in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`;
    const body = isExpired
      ? `Certificate expired on ${cert.expiryDate.toLocaleDateString("en-IE")}. Renewal required.`
      : `Expires on ${cert.expiryDate.toLocaleDateString("en-IE")}. Arrange renewal soon.`;

    for (const manager of managers) {
      await createNotification({
        userId: manager.id,
        type: "cert_expiry",
        title,
        body,
        link: `/training?employeeId=${emp.id}`,
      });
    }

    alertCount++;
  }

  return NextResponse.json({ checked: certs.length, alerts: alertCount });
}
