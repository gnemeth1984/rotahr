/**
 * Import template leads that were parked in ActivityLog because the
 * TemplateLead table didn't exist yet (deploy landed before the migration).
 *
 * Safe to re-run: each parked row is deleted once its lead is in TemplateLead,
 * and captureLead() merges into an existing lead by email. Imported leads skip
 * step 0 if they're older than 2 days (see STEP0_MAX_AGE_DAYS), so nobody gets
 * a late "here's your file" email.
 *
 * Run: DATABASE_URL=<db> bun run scripts/import-pending-template-leads.ts
 */
import { prisma } from "../lib/prisma";
import { captureLead } from "../lib/templates/leads";

async function main() {
  const rows = await prisma.activityLog.findMany({
    where: { action: "template_lead_pending" },
    orderBy: { createdAt: "asc" },
  });
  let imported = 0;
  for (const r of rows) {
    const d = (r.details ?? {}) as Record<string, unknown>;
    if (typeof d.email !== "string" || typeof d.slug !== "string") continue;
    const lead = await captureLead({
      email: d.email,
      slug: d.slug,
      consent: d.consent === true,
      venueType: typeof d.venueType === "string" ? d.venueType : null,
      country: typeof d.country === "string" ? d.country : null,
      ipHash: typeof d.ipHash === "string" ? d.ipHash : null,
    });
    // Keep the original date so the series timing (and step-0 skip) is right.
    if (lead.createdAt > r.createdAt) {
      await prisma.templateLead.update({ where: { id: lead.id }, data: { createdAt: r.createdAt } });
    }
    await prisma.activityLog.delete({ where: { id: r.id } });
    imported++;
  }
  console.log(`imported ${imported} of ${rows.length} parked template leads`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
