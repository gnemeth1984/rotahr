import type { Prisma } from "@prisma/client";

/**
 * What counts as a REAL business.
 *
 * The `Business` table is not what it looks like. At the time of writing it held
 * 106 rows, of which 100 had zero users — they are empty shells created behind
 * the public venue listing pages (/v/...), not tenants. Anything that counts
 * rows in `Business` and calls the result "businesses" is wrong by roughly 17x.
 *
 * That mattered enough to fix at source, because the number feeds the admin
 * dashboard AND Navigator's view of the system. A founder metric that is wrong
 * by an order of magnitude is worse than no metric: it produces confident,
 * wrong decisions.
 *
 * The test: at least one real user account attached. A listing shell never has
 * one; a tenant always does, because signing up is what creates the user.
 * Employees alone are not enough — a shell can be pre-seeded with staff by an
 * import — but a user means somebody logged in and owns it.
 */
export const REAL_BUSINESS_WHERE: Prisma.BusinessWhereInput = {
  users: { some: {} },
};

/**
 * Demo tenants are real (they have users, they get used) but they are not
 * customers, so revenue and adoption reporting must be able to exclude them.
 */
export const DEMO_BUSINESS_IDS = ["demo-anchor-tap-biz", "admin-test-biz"];

export const REAL_CUSTOMER_WHERE: Prisma.BusinessWhereInput = {
  users: { some: {} },
  id: { notIn: DEMO_BUSINESS_IDS },
  // NOT(contains) rather than a nested `not: { contains, mode }`, which Prisma
  // does not type for a nested string filter.
  NOT: { name: { contains: "demo", mode: "insensitive" } },
};

/** True when this business is a listing shell rather than a tenant. */
export function isListingShell(b: { users?: unknown[] } | null | undefined): boolean {
  if (!b) return true;
  return !Array.isArray(b.users) || b.users.length === 0;
}
