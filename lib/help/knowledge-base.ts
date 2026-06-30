// Rotahr Help Knowledge Base
// Static FAQs + feature explanations, role-aware.
// Used by /api/help route before falling back to OpenAI.

export type UserRole = "ADMIN" | "MANAGER" | "STAFF";

export interface HelpEntry {
  keywords: string[];
  roles: UserRole[] | "all";
  answer: string;
}

export const HELP_ENTRIES: HelpEntry[] = [
  // ── ROTA ──────────────────────────────────────────────────────────────────
  {
    keywords: ["rota", "schedule", "roster", "week", "publish"],
    roles: "all",
    answer:
      "**Rota** is the main scheduling view.\n\n• **Staff** — see your published shifts for the week. Use the arrows to move between weeks.\n• **Managers/Admins** — drag to create shifts, click a shift to edit/delete it, then hit **Publish** to make it visible to staff.\n\nCompliance warnings (rest breaks, 48h cap) appear automatically below the rota when issues are detected.",
  },
  {
    keywords: ["publish rota", "publish schedule", "how to publish"],
    roles: ["ADMIN", "MANAGER"],
    answer:
      "To publish the rota:\n\n1. Go to **Rota** in the sidebar\n2. Build your shifts for the week\n3. Click **Publish Week** in the top-right\n\nAll staff will be notified and can see their shifts immediately.",
  },
  {
    keywords: ["compliance", "working time", "rest break", "48 hour", "11 hour", "owt"],
    roles: ["ADMIN", "MANAGER"],
    answer:
      "**Working Time Compliance** (OWT Act 1997) is checked automatically on the Rota page.\n\nAlerts are shown for:\n• **11h rest** — less than 11 hours between shifts\n• **48h weekly cap** — more than 48 hours scheduled in one week\n• **Rest breaks** — shifts over 4.5h (15-min break) or 6h (30-min break)\n• **24h rest** — no continuous 24-hour rest day in the week\n\nThese are warnings only — you're responsible for correcting them.",
  },

  // ── SHIFTS ────────────────────────────────────────────────────────────────
  {
    keywords: ["shift", "my shift", "upcoming shift", "when do i work"],
    roles: "all",
    answer:
      "To view your shifts:\n\n1. Go to **Rota** in the sidebar — your week is shown there\n2. Use the left/right arrows to browse other weeks\n\nYour manager publishes shifts before they become visible. If you see no shifts, ask your manager to publish the schedule.",
  },

  // ── TIME OFF ──────────────────────────────────────────────────────────────
  {
    keywords: ["time off", "leave", "holiday", "vacation", "day off", "annual leave", "request leave"],
    roles: "all",
    answer:
      "To request time off:\n\n1. Go to **Time Off** in the sidebar\n2. Click **New Request**\n3. Select the date range and add a reason\n4. Click **Submit** — your manager gets notified\n\nYou'll receive an email when it's approved or declined. Your statutory annual leave entitlement (8% of hours worked, max 4 weeks) is shown at the top of the page.",
  },
  {
    keywords: ["approve leave", "decline leave", "manage leave", "time off requests"],
    roles: ["ADMIN", "MANAGER"],
    answer:
      "To manage time off requests:\n\n1. Go to **Time Off** in the sidebar\n2. Pending requests are listed at the top\n3. Click **Approve** or **Decline** — the employee is notified by email automatically\n\nApproved leave days are reflected in the Rota.",
  },
  {
    keywords: ["annual leave entitlement", "how many days", "leave balance", "days left"],
    roles: "all",
    answer:
      "Your **annual leave entitlement** is shown at the top of the Time Off page.\n\nRotahr calculates it using the Irish statutory method: **8% of hours worked**, capped at 4 working weeks (as per OWT Act 1997 s.19).\n\n• Days Earned — based on hours worked this leave year\n• Days Taken — approved leave already used\n• Days Remaining — what's left\n\nPublic holidays are additional and not included in this count.",
  },

  // ── PAYROLL ───────────────────────────────────────────────────────────────
  {
    keywords: ["payroll", "pay", "wages", "earnings", "hours", "pay period"],
    roles: ["ADMIN", "MANAGER"],
    answer:
      "The **Payroll** page summarises gross pay per employee for a selected period.\n\n• Choose a date range at the top\n• See hours worked, hourly rate, and gross pay per person\n• A ⚠️ badge appears if anyone is below the Irish NMW (€13.50/hr from Jan 2025)\n\n**Important:** Rotahr shows **gross pay only**. PAYE, PRSI, and USC deductions must be calculated in BrightPay or equivalent payroll software.",
  },
  {
    keywords: ["brightpay", "export", "csv export", "payroll export", "ppsn"],
    roles: ["ADMIN", "MANAGER"],
    answer:
      "To export to BrightPay:\n\n1. Go to **Payroll** and set your date range\n2. Click **BrightPay Export** — a CSV downloads\n\nThe CSV includes Surname, Forename, Email, Hours, and Gross Pay.\n\n⚠️ **PPSN column is blank** — you must add each employee's PPSN before importing to BrightPay or submitting to Revenue. Rotahr does not store PPSNs for data protection reasons.",
  },
  {
    keywords: ["minimum wage", "nmw", "13.50", "below minimum", "wage warning"],
    roles: ["ADMIN", "MANAGER"],
    answer:
      "The Irish **National Minimum Wage** is **€13.50/hr** from 1 January 2025 (National Minimum Wage Act 2000 as amended).\n\nIf any employee's rate is below this, a warning appears on the Payroll page and in the BrightPay export.\n\nTo fix it: go to **Employees → [Employee] → Edit** and update their hourly rate.",
  },

  // ── BOOKINGS ──────────────────────────────────────────────────────────────
  {
    keywords: ["booking", "reservation", "table", "guest", "covers"],
    roles: "all",
    answer:
      "The **Bookings** page manages table reservations.\n\n• **Staff** — view today's reservations and guest counts\n• **Managers/Admins** — create, edit, and cancel bookings; use **AI Assist** to get staffing suggestions based on booking volume\n\nBookings can be filtered by date and status (pending, confirmed, cancelled).",
  },
  {
    keywords: ["ai assist", "staffing suggestion", "booking ai", "ai staffing"],
    roles: ["ADMIN", "MANAGER"],
    answer:
      "**AI Assist** on the Bookings page analyses your upcoming bookings and suggests optimal staffing levels.\n\n1. Go to **Bookings**\n2. Click **AI Assist**\n3. The AI reviews covers, peak times, and your current rota\n4. It suggests if you're over/under-staffed\n\nYou can configure the AI's thresholds in **Settings → AI Assistant**.",
  },

  // ── TIPS ──────────────────────────────────────────────────────────────────
  {
    keywords: ["tips", "gratuity", "tip distribution", "tip pool", "service charge"],
    roles: "all",
    answer:
      "The **Tips** page manages tip distributions in compliance with the **Payment of Wages (Amendment) (Tips and Gratuities) Act 2022**.\n\n• **Staff** — see your tip distributions and the employer's tip policy\n• **Managers/Admins** — create tip pools, record amounts, and distribute to staff\n\nAll distribution records are kept permanently for audit purposes.",
  },
  {
    keywords: ["tip policy", "tips act", "tips law", "display policy"],
    roles: "all",
    answer:
      "Under the **Tips and Gratuities Act 2022**, your employer must display their tip distribution policy to all staff.\n\nYou can view the full policy statement on the **Tips** page — it shows the distribution method, frequency, and your rights.\n\nIf you have concerns about tip distribution, you can contact the **Workplace Relations Commission** at workplacerelations.ie.",
  },

  // ── EMPLOYEES ─────────────────────────────────────────────────────────────
  {
    keywords: ["employee", "staff", "add employee", "new employee", "team member"],
    roles: ["ADMIN", "MANAGER"],
    answer:
      "To manage employees:\n\n1. Go to **Employees** in the sidebar\n2. Click **Add Employee** to create a new profile\n3. Fill in name, email, role, hourly rate, and job title\n4. The employee will receive an invite email to set up their account\n\nClick any employee to edit their profile or view their hours/pay history.",
  },
  {
    keywords: ["role", "permission", "admin", "manager", "staff role", "access"],
    roles: ["ADMIN", "MANAGER"],
    answer:
      "Rotahr has three roles:\n\n• **Admin** — full access: all settings, billing, employees, all data\n• **Manager** — scheduling, payroll, bookings, tips, time off management\n• **Staff** — view own shifts, request time off, view tips and specials\n\nTo change a role: go to **Employees → [Employee] → Edit → Role**.",
  },

  // ── MESSAGES ──────────────────────────────────────────────────────────────
  {
    keywords: ["message", "chat", "direct message", "contact", "inbox"],
    roles: "all",
    answer:
      "The **Messages** page lets you chat directly with other team members.\n\n1. Go to **Messages** in the sidebar\n2. Click a conversation or start a new one\n3. Type and send\n\nManagers can message all staff. Staff can message managers and each other.",
  },

  // ── MENU SPECIALS ─────────────────────────────────────────────────────────
  {
    keywords: ["specials", "menu", "daily special", "announcement", "menu change", "pinned"],
    roles: "all",
    answer:
      "**Menu Specials** is where managers post daily specials, menu changes, and team announcements.\n\n• **Staff** — see all active specials and announcements on this page\n• **Managers/Admins** — click **New Special** to add a post with title, description, date range, and category (Special / Menu Change / Announcement)\n\nPinned posts always appear at the top.",
  },

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  {
    keywords: ["settings", "venue", "business", "profile", "account"],
    roles: ["ADMIN", "MANAGER"],
    answer:
      "**Settings** is split into tabs:\n\n• **General** — business name, address, contact info\n• **Venue** — venue details and location\n• **AI Assistant** — configure booking thresholds for AI staffing suggestions\n• **Billing** — manage your Rotahr subscription plan\n\nOnly Admins can access Billing. Managers can update General and Venue info.",
  },
  {
    keywords: ["billing", "subscription", "plan", "upgrade", "starter", "pro", "enterprise"],
    roles: ["ADMIN"],
    answer:
      "To manage your subscription:\n\n1. Go to **Settings → Billing**\n2. View your current plan (Starter / Pro / Enterprise)\n3. Click **Upgrade** or **Manage** to change or cancel\n\n**Plans (incl. 23% Irish VAT):**\n• Starter — €59/mo (up to 15 staff)\n• Pro — €119/mo (up to 30 staff)\n• Enterprise — €215+/mo (unlimited, multi-venue)\n\nPayments are processed securely via Lemon Squeezy.",
  },

  // ── CLOCK IN/OUT ──────────────────────────────────────────────────────────
  {
    keywords: ["clock in", "clock out", "attendance", "time tracking", "clocked"],
    roles: "all",
    answer:
      "To clock in/out:\n\n1. Go to your **Dashboard** or the **Rota** page\n2. Use the **Clock In** button when your shift starts\n3. Use **Clock Out** when you finish\n\nYour attendance is recorded and feeds into payroll hours automatically.",
  },

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
  {
    keywords: ["notification", "push notification", "alert", "email notification"],
    roles: "all",
    answer:
      "Rotahr sends notifications for:\n\n• New shift assigned\n• Shift changed or cancelled\n• Time off approved/declined\n• New message received\n• Rota published\n• Clock in/out reminders\n\nInstall the Rotahr app on your phone (use **Add to Home Screen** in your browser) to receive push notifications.",
  },

  // ── EXPENSES / RECEIPTS ───────────────────────────────────────────────────
  {
    keywords: ["expense", "receipt", "receipt upload", "bookkeeping", "vat", "cost"],
    roles: ["ADMIN", "MANAGER"],
    answer:
      "The **Expenses** page handles business bookkeeping.\n\n1. Click **Add Expense** or upload a receipt image\n2. AI reads the receipt automatically (amount, vendor, date, VAT)\n3. Review and edit before saving\n4. Track by category, export to CSV, view P&L\n\nVAT breakdown and per-employee costs are shown on the dashboard. Receipts are purged after 90 days per GDPR policy.",
  },

  // ── GENERAL / GETTING STARTED ─────────────────────────────────────────────
  {
    keywords: ["get started", "how do i", "how to use", "what can", "help", "guide", "tutorial"],
    roles: "all",
    answer:
      "Welcome to Rotahr! Here's a quick guide:\n\n**For Staff:**\n• **Rota** — view your shifts\n• **Time Off** — request leave\n• **Tips** — see your distributions\n• **Messages** — chat with the team\n\n**For Managers/Admins:**\n• **Rota** — build and publish schedules\n• **Employees** — manage your team\n• **Payroll** — generate pay summaries\n• **Bookings** — manage reservations\n• **Expenses** — track business costs\n• **Settings** — configure your venue\n\nAsk me anything specific and I'll explain how it works!",
  },
];

/**
 * Find the best matching FAQ entry for a query.
 * Returns null if no strong match (triggers OpenAI fallback).
 */
export function findFAQAnswer(
  query: string,
  role: UserRole
): string | null {
  const q = query.toLowerCase();

  let bestEntry: HelpEntry | null = null;
  let bestScore = 0;

  for (const entry of HELP_ENTRIES) {
    // Role check
    if (entry.roles !== "all" && !entry.roles.includes(role)) continue;

    // Keyword match score
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw)) score += kw.split(" ").length; // longer match = higher score
    }

    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  // Only return if we have a confident match (at least 1 keyword hit)
  return bestScore >= 1 && bestEntry ? bestEntry.answer : null;
}
