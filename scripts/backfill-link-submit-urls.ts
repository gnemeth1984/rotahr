/**
 * Backfills submitUrl on the hand-seeded LinkProspect rows.
 *
 * Every seeded row shipped with only a homepage `url`, which is the least
 * useful link of the pair: knowing Capterra exists is not the blocker, finding
 * the vendor form buried three clicks into their marketing site is. The Links
 * tab and the Navigator task both render submitUrl now, so filling it turns a
 * "go and figure it out" row into a "click and paste" one.
 *
 * Verified 16 Aug 2026 where noted. Several of these return 403 to curl because
 * the sites block non-browser user agents - that is bot protection, not a dead
 * link, and is exactly why these submissions cannot be automated.
 *
 * Safe to re-run: matches on name, only writes when the value differs.
 */

import { prisma } from "../lib/db";

const SUBMIT_URLS: Record<string, string> = {
  // Confirmed via Capterra's own vendor docs.
  Capterra: "https://vendors.capterra.com",
  // Verified 200 from the sandbox.
  G2: "https://sell.g2.com/create-a-profile",
  GetApp: "https://vendors.capterra.com",
  "Software Advice": "https://www.softwareadvice.com/vendor-listing-faq/",
  "Product Hunt": "https://www.producthunt.com/posts/new",
  Crunchbase: "https://www.crunchbase.com/add-new",
  AlternativeTo: "https://alternativeto.net/manage/app/new/",
  SaaSHub: "https://www.saashub.com/submit",
  "SourceForge (Business Software)": "https://sourceforge.net/create/",
  "r/restaurateur": "https://www.reddit.com/r/restaurateur/submit",
  "Restaurants Association of Ireland — trade partner": "https://www.rai.ie/how-to-partner/",
  "Institute of Hospitality": "https://www.instituteofhospitality.org/membership/",
};

/**
 * Capterra, GetApp and Software Advice run one shared catalogue, and G2 agreed
 * to buy all three from Gartner. The practical consequence for us is that these
 * are not four independent submissions - the Capterra profile is the parent
 * record, so check whether it has already propagated before spending a slot.
 */
const NOTES: Record<string, string> = {
  GetApp:
    "Shares Capterra's catalogue (same owner). Check whether the existing Capterra listing has already propagated before submitting - it usually does. Only submit if a search for Rotahr on getapp.com returns nothing.",
  "Software Advice":
    "Shares Capterra's catalogue (same owner). Check for an auto-propagated listing before submitting.",
  Capterra:
    "Live since 11 Aug 2026. Also live on the Canadian domain: https://www.capterra.ca/software/1111434/Rotahr",
};

async function main() {
  let updated = 0;
  const rows = await prisma.linkProspect.findMany();

  for (const row of rows) {
    const submitUrl = SUBMIT_URLS[row.name];
    const note = NOTES[row.name];
    const data: Record<string, unknown> = {};

    if (submitUrl && row.submitUrl !== submitUrl) data.submitUrl = submitUrl;

    // Appended, never replaced - the seeded contactNote holds the angle and
    // the editor's name, which is worth more than anything written here.
    if (note && !(row.contactNote ?? "").includes(note)) {
      data.contactNote = row.contactNote ? `${row.contactNote}\n\n${note}` : note;
    }

    if (Object.keys(data).length === 0) continue;
    await prisma.linkProspect.update({ where: { id: row.id }, data });
    updated++;
    console.log(`updated  ${row.name}`);
  }

  console.log(`\n${updated} row(s) updated of ${rows.length}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
