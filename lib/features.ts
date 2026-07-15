/**
 * Feature Flags system for Rotahr
 * 
 * Each feature has:
 *  - key: unique identifier used in sidebar + API checks
 *  - label: human-readable name shown in settings
 *  - description: plain English explanation of what the feature does
 *  - defaultRoles: which roles can see it by default
 *  - alwaysForAdmin: ADMIN always sees it regardless (can't be hidden from owner)
 *  - canRestrictToRoles: the roles that can be toggled on/off per feature
 *  - category: grouping for the settings UI
 */

export const FEATURE_DEFINITIONS = [
  // ── Core (always on, can only restrict roles) ────────────────────────────
  {
    key: "dashboard",
    label: "Dashboard",
    description: "The main overview page showing upcoming shifts, stats, and activity. Every role sees this by default.",
    category: "Core",
    defaultRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
    canDisable: false, // always on
    canRestrictToRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    key: "rota",
    label: "Rota",
    description: "The weekly staff schedule. Managers build it; staff view their own shifts.",
    category: "Core",
    defaultRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
    canDisable: false,
    canRestrictToRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    key: "timeoff",
    label: "Time Off Requests",
    description: "Staff submit time off requests; managers approve or reject them.",
    category: "Core",
    defaultRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    key: "clock",
    label: "Clock In / Out",
    description: "Staff clock in and out of shifts using GPS or QR code. Managers see live attendance.",
    category: "Core",
    defaultRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    key: "messages",
    label: "Messages",
    description: "Internal messaging between staff and managers.",
    category: "Core",
    defaultRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    key: "availability",
    label: "Availability",
    description: "Staff set their weekly availability and flag dates they can work extra shifts.",
    category: "Core",
    defaultRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    key: "shiftswaps",
    label: "Shift Swaps",
    description: "Staff request to swap shifts with colleagues. Managers approve or reject swaps.",
    category: "Core",
    defaultRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },

  // ── Operations ───────────────────────────────────────────────────────────
  {
    key: "bookings",
    label: "Bookings & Reservations",
    description: "Manage table reservations and customer bookings. Includes the AI booking assistant.",
    category: "Operations",
    defaultRoles: ["MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    key: "menu-specials",
    label: "Menu & Planning",
    description: "Post daily specials, menu changes, and announcements. All staff can view; managers post.",
    category: "Operations",
    defaultRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    key: "stock",
    label: "Stock & Orders",
    description: "Track stock levels, manage suppliers, and raise purchase orders.",
    category: "Operations",
    defaultRoles: ["MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },

  // ── Finance ──────────────────────────────────────────────────────────────
  {
    key: "bookkeeping",
    label: "Bookkeeping & Expenses",
    description: "Upload receipts, log expenses, and view financial reports. AI reads receipt data automatically.",
    category: "Finance",
    defaultRoles: ["MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["MANAGER", "ADMIN"],
  },
  {
    key: "payroll",
    label: "Payroll",
    description: "Calculate wages based on hours worked and wage rates. Generate payslip exports.",
    category: "Finance",
    defaultRoles: ["MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["MANAGER", "ADMIN"],
  },
  {
    key: "reports",
    label: "Reports & Insights",
    description: "Labour cost vs revenue trends over time, overtime tracking, and forecast accuracy — visual dashboards for smarter scheduling decisions.",
    category: "Finance",
    defaultRoles: ["MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["MANAGER", "ADMIN"],
  },
  {
    key: "tips",
    label: "Tips & Tronc",
    description: "Pool and distribute customer tips fairly across staff. Fully compliant with the Irish Tips Act 2022.",
    category: "Finance",
    defaultRoles: ["MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },

  // ── People ───────────────────────────────────────────────────────────────
  {
    key: "employees",
    label: "Employees",
    description: "Manage staff profiles, roles, permissions, wages, and employment details.",
    category: "People",
    defaultRoles: ["MANAGER", "ADMIN"],
    canDisable: false, // can't disable — core HR
    canRestrictToRoles: ["MANAGER", "ADMIN"],
  },
  {
    key: "training",
    label: "Training & Certifications",
    description: "Track HACCP, bar certs, food safety, and other staff certifications with expiry alerts.",
    category: "People",
    defaultRoles: ["MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    key: "logbook",
    label: "Manager Log Book & Tasks",
    description: "Daily shift notes, out-of-stock (86'd) items, maintenance/repair issues, and assignable ops tasks with photo proof of completion.",
    category: "Core",
    defaultRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },

  // ── Compliance ───────────────────────────────────────────────────────────
  {
    key: "haccp",
    label: "HACCP Food Safety",
    description: "Digital HACCP records — temperature logs, delivery checks, cleaning records, and incident reports. Fully paperless compliance for Irish food businesses.",
    category: "Compliance",
    defaultRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },

  // ── AI & Tools ───────────────────────────────────────────────────────────
  {
    key: "ai",
    label: "AI Tools",
    description: "AI-powered scheduling suggestions, cost optimisation, and booking assistant configuration.",
    category: "AI & Tools",
    defaultRoles: ["MANAGER", "ADMIN"],
    canDisable: true,
    canRestrictToRoles: ["MANAGER", "ADMIN"],
  },
] as const;

export type FeatureKey = (typeof FEATURE_DEFINITIONS)[number]["key"];

export interface FeatureFlag {
  enabled: boolean;
  roles: string[]; // which roles can see this feature
}

export type FeatureFlags = Partial<Record<FeatureKey, FeatureFlag>>;

/**
 * Merge stored flags with defaults so missing keys always fall back to default.
 */
export function resolveFeatureFlags(stored: FeatureFlags | null | undefined): Record<FeatureKey, FeatureFlag> {
  const result = {} as Record<FeatureKey, FeatureFlag>;
  for (const def of FEATURE_DEFINITIONS) {
    const saved = stored?.[def.key as FeatureKey];
    result[def.key as FeatureKey] = {
      enabled: saved?.enabled ?? true,
      roles: saved?.roles ?? [...def.defaultRoles],
    };
  }
  return result;
}

/**
 * Check if a feature is visible to a given role.
 */
export function canSeeFeature(
  flags: Record<FeatureKey, FeatureFlag> | null | undefined,
  key: FeatureKey,
  role: string
): boolean {
  if (!flags) return true; // no flags = all on
  const flag = flags[key];
  if (!flag) return true;
  if (!flag.enabled) return false;
  return flag.roles.includes(role);
}
