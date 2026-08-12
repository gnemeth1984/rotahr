/**
 * Re-run the corrected name check over leads this pass already created.
 *
 * The first version of nameMismatch() scored 16/20 on real rows: four correct
 * gmail addresses were flagged because only the mailbox domain was compared,
 * and two mailboxes belonging to entirely different pubs went through clean.
 * Those verdicts are already written into OutreachLead.notes, where a human
 * will read them before sending — so they have to be rewritten, not left to
 * mislead.
 *
 * Only ever touches leads that are `unverified`, never contacted, and sourced
 * by this pass. Any lead further along is left exactly as it is.
 *
 *   npx tsx --env-file=.env.local scripts/reflag-osm-leads.ts --dry
 */
import { prisma } from "@/lib/prisma";
import { nameMismatch, UNVERIFIED_STATUS } from "@/lib/outreach/candidate-to-lead";

const dry = process.argv.includes("--dry");

/**
 * The website lives on the candidate row, matched by EMAIL not by name.
 *
 * Matching on name first cleared four genuine mismatches — "Foley's Bar" →
 * info@oneillsmerrionrow.ie looked fine because a different Foley's elsewhere
 * in the table had foleysbar.ie on it, and that stranger's domain satisfied the
 * check. Irish pub names repeat constantly, so the name is not a key. The email
 * this pass wrote onto the candidate row is.
 */
async function siteFor(email: string): Promise<string | null> {
  const c = await prisma.venueCandidate.findFirst({
    where: { email },
    select: { websiteFound: true },
  });
  return c?.websiteFound ?? null;
}

async function main() {
  const leads = await prisma.outreachLead.findMany({
    where: {
      source: "osm-discovery",
      status: UNVERIFIED_STATUS,
      contactCount: 0,
      lastContacted: null,
    },
    select: { id: true, email: true, name: true, notes: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`${leads.length} unverified osm-discovery lead(s)${dry ? " (dry run)" : ""}\n`);

  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const lead of leads) {
    const site = await siteFor(lead.email);
    const flag = nameMismatch(lead.name, lead.email, site);
    const had = lead.notes?.includes("[check name]") ?? false;

    if (!!flag === had) {
      unchanged++;
      continue;
    }

    // Strip any old flag line, then append the new verdict if there is one.
    const base = (lead.notes ?? "")
      .split("\n")
      .filter((l) => !l.startsWith("[check name]"))
      .join("\n")
      .trimEnd();
    const notes = flag ? `${base}\n[check name] ${flag}` : base;

    if (flag) {
      added++;
      console.log(`+ FLAG  ${lead.name} -> ${lead.email}`);
      console.log(`        ${flag}`);
    } else {
      removed++;
      console.log(`- clear ${lead.name} -> ${lead.email}  (old flag was a false positive)`);
    }

    if (!dry) await prisma.outreachLead.update({ where: { id: lead.id }, data: { notes } });
  }

  console.log(`\nflag added: ${added}, false positive cleared: ${removed}, unchanged: ${unchanged}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
