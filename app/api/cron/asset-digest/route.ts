// Weekly cron: email each business's managers what equipment is coming due.
//
// Gabor chose a weekly digest over push notifications: a warranty lapsing in
// 6 weeks is not an interrupt, and the cert-expiry cron already proved that
// per-item notifications for slow-moving dates just train you to dismiss the
// bell. One email, Monday morning, with the whole picture.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmailQuiet } from "@/lib/email/send";
import { wrapCron } from "@/lib/cron-run";
import {
  warrantyStatus,
  serviceStatus,
  needsAttention,
  daysUntil,
  fmtDate,
  WARRANTY_SOON_DAYS,
  SERVICE_SOON_DAYS,
  RECENTLY_PASSED_DAYS,
} from "@/lib/assets/status";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Row = {
  name: string;
  location: string | null;
  contact: string;
  line: string;
  urgent: boolean;
};

async function __cronHandler(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + WARRANTY_SOON_DAYS * 86400000);
  const floor = new Date(now.getTime() - RECENTLY_PASSED_DAYS * 86400000);

  // Only pull rows that could possibly be relevant. Retired kit is excluded —
  // nobody needs a reminder to service a fryer they sold.
  const assets = await prisma.asset.findMany({
    where: {
      status: { not: "retired" },
      OR: [
        { warrantyExpiry: { gte: floor, lte: horizon } },
        { nextServiceDate: { gte: floor, lte: horizon } },
      ],
    },
    select: {
      id: true,
      businessId: true,
      name: true,
      location: true,
      status: true,
      warrantyExpiry: true,
      nextServiceDate: true,
      contactCompany: true,
      contactName: true,
      contactPhone: true,
    },
  });

  if (assets.length === 0) {
    return NextResponse.json({ businesses: 0, assets: 0, emails: 0 });
  }

  // Group by business
  const byBusiness = new Map<string, typeof assets>();
  for (const a of assets) {
    if (!needsAttention(a, now)) continue;
    const list = byBusiness.get(a.businessId) ?? [];
    list.push(a);
    byBusiness.set(a.businessId, list);
  }

  let emails = 0;
  let skipped = 0;

  for (const [businessId, list] of byBusiness) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, currency: true },
    });
    if (!business) continue;

    const managers = await prisma.user.findMany({
      where: { businessId, role: { in: ["MANAGER", "ADMIN"] } },
      select: { email: true },
    });
    const to = managers.map((m) => m.email).filter((e): e is string => Boolean(e));
    if (to.length === 0) {
      skipped++;
      continue;
    }

    const overdue: Row[] = [];
    const soon: Row[] = [];

    for (const a of list) {
      const wDays = daysUntil(a.warrantyExpiry, now);
      const sDays = daysUntil(a.nextServiceDate, now);
      const w = warrantyStatus(a.warrantyExpiry, now);
      const s = serviceStatus(a.nextServiceDate, now);

      const contactBits = [a.contactCompany, a.contactName, a.contactPhone].filter(Boolean);
      const contact = contactBits.length ? contactBits.join(" · ") : "No contact saved";

      if (s === "OVERDUE" && sDays !== null && sDays >= -RECENTLY_PASSED_DAYS) {
        overdue.push({
          name: a.name,
          location: a.location,
          contact,
          line: `Service overdue by ${Math.abs(sDays)} day${Math.abs(sDays) === 1 ? "" : "s"} (was due ${fmtDate(a.nextServiceDate)})`,
          urgent: true,
        });
      } else if (s === "DUE_SOON" && sDays !== null) {
        soon.push({
          name: a.name,
          location: a.location,
          contact,
          line: `Service due in ${sDays} day${sDays === 1 ? "" : "s"} — ${fmtDate(a.nextServiceDate)}`,
          urgent: false,
        });
      }

      if (w === "EXPIRING_SOON" && wDays !== null) {
        soon.push({
          name: a.name,
          location: a.location,
          contact,
          line: `Warranty expires in ${wDays} day${wDays === 1 ? "" : "s"} — ${fmtDate(a.warrantyExpiry)}`,
          urgent: wDays <= 14,
        });
      } else if (w === "EXPIRED" && wDays !== null && wDays >= -RECENTLY_PASSED_DAYS) {
        overdue.push({
          name: a.name,
          location: a.location,
          contact,
          line: `Warranty expired ${fmtDate(a.warrantyExpiry)} — any callout is now chargeable`,
          urgent: false,
        });
      }
    }

    if (overdue.length === 0 && soon.length === 0) continue;

    const rowHtml = (r: Row) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ec;">
          <div style="font-weight:600;color:#0f1c35;">${esc(r.name)}${
            r.location ? `<span style="font-weight:400;color:#6b7280;"> · ${esc(r.location)}</span>` : ""
          }</div>
          <div style="font-size:13px;color:${r.urgent ? "#c2410c" : "#374151"};margin-top:2px;">${esc(r.line)}</div>
          <div style="font-size:12px;color:#9ca3af;margin-top:2px;">${esc(r.contact)}</div>
        </td>
      </tr>`;

    const section = (title: string, rows: Row[], accent: string) =>
      rows.length === 0
        ? ""
        : `
      <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:${accent};margin:24px 0 8px;">
        ${esc(title)} (${rows.length})
      </h3>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e6e8ec;border-radius:8px;overflow:hidden;">
        ${rows.map(rowHtml).join("")}
      </table>`;

    const total = overdue.length + soon.length;
    const subject =
      overdue.length > 0
        ? `${business.name}: ${overdue.length} overdue, ${soon.length} coming due`
        : `${business.name}: ${soon.length} item${soon.length === 1 ? "" : "s"} coming due`;

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f1c35;">
  <h2 style="margin:0 0 4px;font-size:20px;">Equipment &amp; service — week ahead</h2>
  <p style="margin:0 0 4px;color:#6b7280;font-size:14px;">${esc(business.name)} · ${total} item${total === 1 ? "" : "s"} need a look</p>
  <p style="margin:0;color:#9ca3af;font-size:13px;">Service due inside ${SERVICE_SOON_DAYS} days, warranties inside ${WARRANTY_SOON_DAYS} days.</p>

  ${section("Needs action now", overdue, "#c2410c")}
  ${section("Coming up", soon, "#0f1c35")}

  <p style="margin:24px 0 0;">
    <a href="https://rotahr.com/assets" style="display:inline-block;background:#ff6b35;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;">
      Open the asset register
    </a>
  </p>
  <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;line-height:1.5;">
    Log a service on an item and Rotahr rolls its next date forward automatically.
    Costs shown in the register are notes only — nothing is ever booked to your accounts.
  </p>
</div>`;

    const text = [
      `Equipment & service — week ahead`,
      `${business.name} · ${total} item(s) need a look`,
      "",
      ...(overdue.length ? ["NEEDS ACTION NOW:", ...overdue.map((r) => `- ${r.name}: ${r.line}`), ""] : []),
      ...(soon.length ? ["COMING UP:", ...soon.map((r) => `- ${r.name}: ${r.line}`), ""] : []),
      `https://rotahr.com/assets`,
    ].join("\n");

    // sendEmailQuiet: a failed digest must never fail the cron for every other
    // business in the loop.
    const res = await sendEmailQuiet({
      to,
      subject,
      html,
      text,
      context: "asset-digest",
    });
    if (res.ok) emails++;
  }

  return NextResponse.json({
    businesses: byBusiness.size,
    assets: assets.length,
    emails,
    skippedNoManagers: skipped,
  });
}

export const GET = wrapCron("asset-digest", __cronHandler as any);
