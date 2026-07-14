/**
 * The ONLY list of real platform super-admins (Gabor). Business owners/admins
 * (role: ADMIN within their own business, e.g. every paying customer or demo
 * owner account) must NEVER be treated as platform admins — they should only
 * ever see/manage their own business's data.
 *
 * Import this everywhere platform-admin access is checked — never re-derive
 * "is this a platform admin" from role or businessId alone, both can be true
 * for a normal business owner.
 */
export const SUPER_ADMINS = ["gnemeth1984@gmail.com"];

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMINS.includes(email);
}
