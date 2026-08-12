/**
 * Backfills `OutreachLead.status = 'unsubscribed'` from the suppression table,
 * and restores leads that a mail-security scanner opted out on the venue's
 * behalf.
 *
 * Two separate jobs, one script, because they have to agree about which rows
 * are which:
 *
 *  - Backfill: every active suppression that matches a lead still reading a
 *    sendable status. Sending was already blocked by `isSuppressed()`; this
 *    only fixes the reported number.
 *  - Restore: an opt-out is a person's decision, so the bar for undoing one is
 *    deliberately high. Only rows whose user-agent is unambiguously a machine
 *    (an HTTP library, or a browser too old to be real) qualify. A fast
 *    opt-out on a normal browser UA is left alone, even where the timing looks
 *    robotic — a scanner rendering pages with a real UA string is
 *    indistinguishable from a very quick human, and wrongly resuming mail to
 *    someone who did opt out is the worse error.
 *
 * Run with --dry first.
 */
import { prisma } from "@/lib/db";

const DRY = process.argv.includes("--dry");

/** HTTP clients and browsers no human is running in 2026. */
const MACHINE_UA = /python|aiohttp|curl|wget|go-http|okhttp|java\/|libwww|MSIE [678]\.0/i;

/** Local parts left behind by link-rewriting gateways, not real mailboxes. */
const SCRAMBLED_LOCAL = /^(vaab|efffeibgvbaf|fevachetu|ufyyb|fcvgbyavfyef)$/;

/**
 * Statuses an opt-out should overwrite. Includes `listing_invited`: it is not a
 * sequence step, so `findEligibleLeads()` never picks those rows and nothing
 * would ever have corrected them — 4 of the hotels that opted out on 10 Aug are
 * parked there. Terminal states (`replied`, `bounced`, `converted`) are excluded
 * because they carry more information than `unsubscribed` does.
 */
const OVERRIDABLE_STATUSES = [
  "new",
  "contacted",
  "followup_1",
  "followup_2",
  "followup_3",
  "cold",
  "listing_invited",
];

async function main() {
  const suppressions = await prisma.emailSuppression.findMany({
    where: { revokedAt: null },
    select: { email: true, source: true, reason: true, userAgent: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`${suppressions.length} active suppressions`);
  console.log(DRY ? "-- DRY RUN, nothing written --\n" : "-- WRITING --\n");

  // ---- 1. backfill status on genuinely suppressed leads ----
  let backfilled = 0;
  const restorable: { email: string; ua: string; at: string }[] = [];

  for (const s of suppressions) {
    const lead = await prisma.outreachLead.findUnique({
      where: { email: s.email },
      select: { id: true, name: true, status: true, contactCount: true },
    });
    if (!lead) continue;

    const local = s.email.split("@")[0];
    const machine = MACHINE_UA.test(s.userAgent || "");

    if (machine && !SCRAMBLED_LOCAL.test(local)) {
      restorable.push({
        email: s.email,
        ua: (s.userAgent || "").slice(0, 50),
        at: s.createdAt.toISOString().slice(0, 19),
      });
      continue;
    }

    if (OVERRIDABLE_STATUSES.includes(lead.status)) {
      console.log(`  backfill ${s.email} (${lead.name}) ${lead.status} -> unsubscribed`);
      if (!DRY) {
        await prisma.outreachLead.update({
          where: { id: lead.id },
          data: { status: "unsubscribed" },
        });
      }
      backfilled++;
    }
  }

  // ---- 2. restore machine-triggered opt-outs ----
  console.log(`\n${restorable.length} machine-triggered opt-outs to restore:`);
  let restored = 0;
  for (const r of restorable) {
    const lead = await prisma.outreachLead.findUnique({
      where: { email: r.email },
      select: { id: true, name: true, status: true, contactCount: true },
    });
    console.log(`  restore ${r.email} (${lead?.name}) status=${lead?.status} ua=${r.ua} at=${r.at}`);
    if (!DRY) {
      await prisma.emailSuppression.updateMany({
        where: { email: r.email },
        data: { revokedAt: new Date() },
      });
      // Only touch status if the backfill or a send had already parked it on
      // unsubscribed; a lead still reading `contacted` is already correct.
      if (lead && lead.status === "unsubscribed") {
        await prisma.outreachLead.update({
          where: { id: lead.id },
          data: { status: lead.contactCount > 0 ? "contacted" : "new" },
        });
      }
    }
    restored++;
  }

  const nowUnsub = await prisma.outreachLead.count({ where: { status: "unsubscribed" } });
  const activeSuppressions = await prisma.emailSuppression.count({ where: { revokedAt: null } });
  console.log(
    `\nbackfilled ${backfilled}, restored ${restored}` +
      `\nleads on status=unsubscribed: ${nowUnsub}` +
      `\nactive suppressions: ${activeSuppressions}`
  );

  await prisma.$disconnect();
}

main();
