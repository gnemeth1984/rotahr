import { timingSafeEqual } from "node:crypto";

/** Constant-time Bearer check. A missing/empty CRON_SECRET always fails closed. */
export function validCronAuth(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`); const actual = Buffer.from(header);
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
