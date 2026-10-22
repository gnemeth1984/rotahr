/**
 * lib/marketing/changelog.ts — the public "What's new" list.
 *
 * Rendered by app/whats-new/page.tsx and linked from the footer, the launch
 * emails and the social posts. Every entry must describe something that is
 * live in production, in the same plain terms as the feature pages: what it
 * does, and where the limit is. Newest release first.
 */

export interface ChangelogItem {
  title: string;
  detail: string;
  /** Internal link to the page that explains it, when there is one. */
  href?: string;
}

export interface ChangelogRelease {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  title: string;
  summary: string;
  items: ChangelogItem[];
}

export const CHANGELOG: ChangelogRelease[] = [
  {
    date: "2026-10-22",
    title: "Manager Copilot, supplier price history and per-venue labour %",
    summary:
      "The biggest release since launch: a daily brief that reads the rest of Rotahr for the manager, a price history behind every stock item, and revenue per venue for multi-site groups. Included on every plan, at no extra cost.",
    items: [
      {
        title: "Manager Copilot",
        detail:
          "One page each morning with today's five priorities, a Tonight panel (covers, bookings, busiest hour, allergy tables, occasions) and an Ask box. Five read-only checks run on the venue's own data: Compliance Monitor, Margin Guard, Stock Waste Advisor, Booking Forecast and No-show Guard. It suggests a menu price, drafts a confirmation message and flags a short-staffed hour, but nothing is sent or changed automatically.",
        href: "/features/manager-copilot",
      },
      {
        title: "Margin Guard and a target GP",
        detail:
          "When a supplier price rises, the dishes that use it are re-costed and compared against your target gross profit, which defaults to 70% and can be changed on the Copilot page.",
        href: "/features/stock-recipe-costing",
      },
      {
        title: "Booking Forecast against the rota",
        detail:
          "Covers for the next 7 days are forecast from how fast bookings came in on the same weekday in previous weeks, then compared with the kitchen, floor and bar staff rostered at the peak hour.",
        href: "/features/table-bookings",
      },
      {
        title: "No-show Guard",
        detail:
          "Bookings most likely not to turn up, scored from the guest's own history, party size and lead time, with the reason shown and a confirmation message drafted for the manager to copy.",
        href: "/features/guest-crm",
      },
      {
        title: "Guest and staff details stay out of the AI",
        detail:
          "The checks run inside Rotahr. The AI only words the summary and answers typed questions, and names, emails, phone numbers and record IDs are stripped before anything is sent. If the AI is unavailable the same findings show in plain text.",
        href: "/features/manager-copilot",
      },
      {
        title: "Supplier price history",
        detail:
          "Every change to a stock item's pack price is now recorded with the date and its source: a stock edit, a scanned receipt, a delivery note or a supplier statement reconciliation.",
        href: "/features/stock-recipe-costing",
      },
      {
        title: "Who can use it",
        detail:
          "Admins and managers by default. A member of staff, such as a head chef, can be given the Manager Copilot permission individually, and the whole feature can be switched off per business in Settings → Features.",
      },
    ],
  },
  {
    date: "2026-10-21",
    title: "Multi-venue reporting, staff invites and privacy fixes",
    summary:
      "Groundwork for multi-site operators and a set of privacy and security fixes across the app.",
    items: [
      {
        title: "POS revenue per venue",
        detail:
          "Each POS connection can be assigned to a venue, and daily POS totals are kept per venue rather than for the business as a whole.",
      },
      {
        title: "Labour % per venue",
        detail:
          "The labour cost report now shows revenue and labour % per venue, with a venue filter. Takings from a POS that is not assigned to a venue are shown as unattributed.",
        href: "/features/time-tracking-payroll",
      },
      {
        title: "Staff invites by email",
        detail:
          "Invite a new starter by email and they set their own password from the link (valid for 7 days), instead of a manager choosing one for them.",
        href: "/features/staff-scheduling",
      },
      {
        title: "Private staff contact details",
        detail:
          "In the staff directory, team members now see only their own contact details. Managers still see the whole team.",
      },
      {
        title: "Clock-in geofence checked on the server",
        detail:
          "When a venue has a geofence set, the server now checks the phone's location and accuracy before accepting a clock-in, rather than relying on the app screen alone. Clocking out is never blocked, and each clock event records whether it was inside the fence.",
        href: "/features/time-tracking-payroll",
      },
      {
        title: "Consistent no-show status",
        detail:
          "A booking marked as a no-show now reads the same in bookings, the guest CRM and the dashboard.",
        href: "/features/guest-crm",
      },
      {
        title: "Per-business webhook secret",
        detail:
          "Each business now has its own webhook signing secret instead of one shared across accounts.",
      },
    ],
  },
];

export function formatReleaseDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
