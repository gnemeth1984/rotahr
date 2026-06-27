/**
 * Backfill CRM: groups existing reservations by email per business → creates Customer rows
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/backfill-crm.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting CRM backfill...");

  const businesses = await prisma.business.findMany({ select: { id: true, name: true } });
  console.log(`Found ${businesses.length} businesses`);

  let totalCreated = 0;
  let totalLinked = 0;

  for (const biz of businesses) {
    const reservations = await prisma.reservation.findMany({
      where: { businessId: biz.id, customerId: null },
      orderBy: { date: "asc" },
    });

    if (reservations.length === 0) {
      console.log(`  ${biz.name}: no unlinked reservations`);
      continue;
    }

    console.log(`  ${biz.name}: processing ${reservations.length} reservations...`);

    // Group by email (case-insensitive), fallback to name+phone
    const groups = new Map<string, typeof reservations>();

    for (const r of reservations) {
      const key = r.customerEmail
        ? `email:${r.customerEmail.toLowerCase()}`
        : `name:${r.customerName.toLowerCase()}:${r.customerPhone ?? ""}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    for (const [key, group] of groups.entries()) {
      const first = group[0];
      const email = first.customerEmail || null;

      // Upsert customer
      let customer = email
        ? await prisma.customer.findFirst({
            where: { businessId: biz.id, email: email.toLowerCase() },
          })
        : null;

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            businessId: biz.id,
            name: first.customerName,
            email: email ? email.toLowerCase() : null,
            phone: first.customerPhone ?? null,
            gdprConsent: group.some((r) => r.marketingConsent),
            gdprConsentAt: group.some((r) => r.marketingConsent) ? new Date() : null,
          },
        });
        totalCreated++;
      }

      // Link reservations
      const ids = group.map((r) => r.id);
      await prisma.reservation.updateMany({
        where: { id: { in: ids } },
        data: { customerId: customer.id },
      });
      totalLinked += ids.length;
    }
  }

  console.log(`\nDone! Created ${totalCreated} customers, linked ${totalLinked} reservations.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
