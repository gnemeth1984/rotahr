/**
 * Fixtures for isUnroutableAddress(). Every blocked case is a real address the
 * shift-reminder cron was mailing daily until 12 Aug.
 *
 *   npx tsx scripts/check-unroutable.ts
 */
import { isUnroutableAddress } from "@/lib/email/send";

const cases: [string, boolean][] = [
  // Real demo bounces, one per seeded business.
  ["sarah.connolly@rotahr.demo", true],
  ["luke.flanagan@bloombistro.demo", true],
  ["dan.kearns@cornercafe.demo", true],
  ["mark.doyle@harringtongroup.demo", true],
  ["owner.starter@rotahr.demo", true],
  // Other reserved TLDs.
  ["a@b.test", true],
  ["a@b.invalid", true],
  ["a@localhost", true],
  ["someone@example.com", true],
  ["nobody@", true],
  ["malformed", true],
  // Must still send. rotahr.com is the live domain; .ie/.co.uk are the markets.
  ["sales@rotahr.com", false],
  ["gnemeth1984@gmail.com", false],
  ["hello@thealgiersinn.ie", false],
  ["info@babyhannahs.ie", false],
  ["oldjointstock@fullers.co.uk", false],
  // Not a reserved TLD despite containing the word.
  ["info@demolition-bar.ie", false],
  ["info@testarossa.it", false],
];

let wrong = 0;
for (const [email, should] of cases) {
  const got = isUnroutableAddress(email);
  const ok = got === should;
  if (!ok) wrong++;
  console.log(`${ok ? "ok  " : "WRONG"} ${got ? "BLOCK" : "send "}  ${email}`);
}
console.log(`\n${cases.length - wrong}/${cases.length} correct`);
if (wrong > 0) process.exit(1);
