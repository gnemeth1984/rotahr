/**
 * Fixtures for nameMismatch(), every one taken from a real row of the 12 Aug
 * conversion run. The first version of the check scored 16/20 on these: it
 * flagged four correct gmail addresses because it only looked at the domain,
 * and it waved through two mailboxes belonging to entirely different pubs.
 *
 *   npx tsx scripts/check-name-mismatch.ts
 */
import { nameMismatch } from "@/lib/outreach/candidate-to-lead";
const cases: [string, string, string | null, boolean][] = [
  // [name, email, website, shouldFlag]
  ["O’Callaghan’s Bar", "info@fishing-ireland.ie", "https://www.fishing-ireland.ie/", true],
  ["Mol’s Bar", "hello@oneillsbartramore.com", "https://www.oneillsbartramore.com/", true],
  ["Robinson’s", "sadiespub@gmail.com", "https://www.sadiespub.com/", true],
  ["Sin É", "risingsonscork@gmail.com", "https://corkheritagepubs.com/sin-e/", true],
  ["Antiquity", "antiquitywestcork@gmail.com", "https://www.antiquity.ie/", false],
  ["Tom Barry’s", "tom.barrys113@gmail.com", "https://tombarryspubcork.wordpress.com/", false],
  ["The Lady Belle", "theladybellepub@gmail.com", "https://www.theladybellepub.com/", false],
  ["Briar Rose", "thebriardouglas@gmail.com", "https://thebriardouglas.com/", false],
  ["The Oar", "hello@theoar.ie", "https://www.theoarbar.ie/", false],
  ["The Orchard Bar", "enquiries@theorchardhouse.ie", "https://theorchardhouse.ie/orchard-bar/", false],
  ["Connie Foxe's Bar and Steakhouse", "info@imperialhoteltralee.ie", null, true],
  ["Maisie’s", "hello@maisies.ie", "https://maisies.ie/", false],
  ["Roti Indian Street Kitchen", "hello@roti.ie", "https://www.roti.ie/", false],
  ["Cass & Co", "hello@cassandco.ie", "https://www.cassandco.ie/", false],
  ["Baby Hannah’s", "info@babyhannahs.ie", "http://babyhannahs.ie/", false],
  ["J. Daly", "manager@jdalysballydehob.ie", "https://jdalysballydehob.ie/", false],
  ["Amicus", "info@amicusrestaurant.ie", "https://amicusrestaurant.ie/", false],
  ["Sober Lane", "party@soberlane.com", "https://soberlane.ie/", false],
  ["Old Bear", "info@oldbear.ie", "https://oldbear.ie/", false],
  ["JJ Coppinger’s", "thegeneral@jjcoppingers.ie", "https://jjcoppingers.ie/", false],

  // Rule two: the website matches the venue name, but the mailbox sits on a
  // domain belonging to neither the venue nor its site.
  ["Foley's Bar", "info@oneillsmerrionrow.ie", "https://www.foleys.ie/", true],
  ["Bennigan’s", "info@lrbllc.com", "https://bennigans.com/", true],
  ["Number 21", "info@fyrefli.ie", "https://number21.ie/", true],
  ["The Pikeman’s Inn", "info@grandhoteltralee.com", "https://www.grandhoteltralee.com", true],
  ["Mill Wheel Bistro", "millwhellrestaurant@hotmail.com", "https://www.mill-wheel-bistro-rita.online/", false],
  ["Cafe Moly", "info@cafemolyroastery.com", "https://www.cafemolyroastery.com/", false],
];
let wrong = 0;
for (const [n, e, w, should] of cases) {
  const got = nameMismatch(n, e, w);
  const flagged = got !== null;
  const ok = flagged === should;
  if (!ok) wrong++;
  console.log(`${ok ? "ok  " : "WRONG"} ${flagged ? "FLAG" : "pass"}  ${n} -> ${e}`);
  if (!ok && got) console.log(`        ${got}`);
}
console.log(`\n${cases.length - wrong}/${cases.length} correct`);
if (wrong > 0) process.exit(1);
