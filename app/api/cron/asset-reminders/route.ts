// Daily cron: advance warnings for equipment coming due.
//
// Sits alongside asset-digest rather than replacing it, because they answer
// different questions. The Monday digest is a roundup you read with coffee —
// including things already overdue. This is a dated warning about one specific
// item: "the oven service is 30 days out, book someone now".
//
// Gabor asked for two stages, 30 days then 7 days, delivered to the Rotahr bell
// and by email. Each (asset, kind, stage, dueDate) is written to AssetReminder
// once, so a second run on the same day stays silent — but moving a service
// date legitimately re-arms both stages for the new date.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmailQuiet } from "@/lib/email/send";
import { createNotification } from "@/lib/services/appNotification.service";
import { wrapCron } from "@/lib/cron-run";
import {
  dueReminders,
  fmtDate,
  REMINDER_STAGES,
  type ReminderKind,
} from "@/lib/assets/status";

const EQUIPMENT_LINK = "/log-book?tab=equipment";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** What the manager is actually being asked to do. Phrased as an action, not a
 *  status, because a notification that only states a fact gets dismissed. */
function phrasing(kind: ReminderKind, days: number, dueDate: Date) {
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  switch (kind) {
    case "service":
      return {
        headline: `Service due ${when}`,
        action: `Book the engineer — due ${fmtDate(dueDate)}`,
      };
    case "warranty":
      return {
        headline: `Warranty ends ${when}`,
        action: `Any callout after ${fmtDate(dueDate)} is chargeable — get anything outstanding looked at first`,
      };
    case "replace":
      return {
        headline: `Replacement due ${when}`,
        action: `Due for replacing or upgrading by ${fmtDate(dueDate)} — worth pricing up now`,
      };
  }
}

type Pending = {
  assetId: string;
  businessId: string;
  assetName: string;
  location: string | null;
  contact: string;
  kind: ReminderKind;
  stage: number;
  dueDate: Date;
  days: number;
};

async function __cronHandler(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const widest = Math.max(...REMINDER_STAGES);
  const horizon = new Date(now.getTime() + widest * 86400000);

  // Only future-dated rows inside the widest stage can owe a warning. Retired
  // kit is excluded — nobody needs a reminder to service a fryer they sold.
  const assets = await prisma.asset.findMany({
    where: {
      status: { not: "retired" },
      OR: [
        { nextServiceDate: { gte: now, lte: horizon } },
        { warrantyExpiry: { gte: now, lte: horizon } },
        { replaceByDate: { gte: now, lte: horizon } },
      ],
    },
    select: {
      id: true,
      businessId: true,
      name: true,
      location: true,
      nextServiceDate: true,
      warrantyExpiry: true,
      replaceByDate: true,
      contactCompany: true,
      contactName: true,
      contactPhone: true,
    },
  });

  if (assets.length === 0) {
    return NextResponse.json({ assets: 0, sent: 0, alreadySent: 0 });
  }

  // Work out what is owed, then drop anything already recorded.
  const pending: Pending[] = [];
  let alreadySent = 0;

  for (const a of assets) {
    const owed = dueReminders(a, now);
    if (owed.length === 0) continue;

    const contactBits = [a.contactCompany, a.contactName, a.contactPhone].filter(Boolean);
    const contact = contactBits.length ? contactBits.join(" · ") : "No contact saved";

    for (const r of owed) {
      const existing = await prisma.assetReminder.findUnique({
        where: {
          assetId_kind_stage_dueDate: {
            assetId: a.id,
            kind: r.kind,
            stage: r.stage,
            dueDate: r.dueDate,
          },
        },
        select: { id: true },
      });
      if (existing) {
        alreadySent++;
        continue;
      }

      pending.push({
        assetId: a.id,
        businessId: a.businessId,
        assetName: a.name,
        location: a.location,
        contact,
        kind: r.kind,
        stage: r.stage,
        dueDate: r.dueDate,
        days: r.days,
      });
    }
  }

  if (pending.length === 0) {
    return NextResponse.json({ assets: assets.length, sent: 0, alreadySent });
  }

  // Group per business so a venue with four items due gets one email, not four.
  const byBusiness = new Map<string, Pending[]>();
  for (const p of pending) {
    const list = byBusiness.get(p.businessId) ?? [];
    list.push(p);
    byBusiness.set(p.businessId, list);
  }

  let bells = 0;
  let emails = 0;
  let recorded = 0;
  let skippedNoManagers = 0;

  for (const [businessId, list] of byBusiness) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    });
    if (!business) continue;

    const managers = await prisma.user.findMany({
      where: { businessId, role: { in: ["MANAGER", "ADMIN"] } },
      select: { id: true, email: true },
    });
    if (managers.length === 0) {
      skippedNoManagers++;
      continue;
    }

    // Soonest first — the 7-day items are the ones that need action today.
    list.sort((a, b) => a.days - b.days);

    // One bell per item: the whole point is that it names the machine.
    for (const p of list) {
      const { headline, action } = phrasing(p.kind, p.days, p.dueDate);
      const where = p.location ? `${p.assetName} · ${p.location}` : p.assetName;
      for (const m of managers) {
        try {
          await createNotification({
            userId: m.id,
            type: "cert_expiry", // nearest existing NotifType; keeps the bell icon sensible
            title: `${where}: ${headline.toLowerCase()}`,
            body: action,
            link: EQUIPMENT_LINK,
          });
          bells++;
        } catch {
          // A failed bell must not stop the email or the recording.
        }
      }
    }

    const to = managers.map((m) => m.email).filter((e): e is string => Boolean(e));

    if (to.length > 0) {
      const rows = list
        .map((p) => {
          const { headline, action } = phrasing(p.kind, p.days, p.dueDate);
          const urgent = p.stage <= 7;
          return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ec;">
          <div style="font-weight:600;color:#0f1c35;">${esc(p.assetName)}${
            p.location ? `<span style="font-weight:400;color:#6b7280;"> · ${esc(p.location)}</span>` : ""
          }</div>
          <div style="font-size:13px;color:${urgent ? "#c2410c" : "#374151"};margin-top:2px;">
            ${esc(headline)} — ${esc(action)}
          </div>
          <div style="font-size:12px;color:#9ca3af;margin-top:2px;">${esc(p.contact)}</div>
        </td>
      </tr>`;
        })
        .join("");

      const urgentCount = list.filter((p) => p.stage <= 7).length;
      const subject =
        urgentCount > 0
          ? `${business.name}: ${urgentCount} item${urgentCount === 1 ? "" : "s"} due within a week`
          : `${business.name}: ${list.length} item${list.length === 1 ? "" : "s"} due within a month`;

      const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f1c35;">
  <h2 style="margin:0 0 4px;font-size:20px;">Equipment coming due</h2>
  <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
    ${esc(business.name)} · advance notice so it can be arranged, not chased
  </p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e6e8ec;border-radius:8px;overflow:hidden;">
    ${rows}
  </table>
  <p style="margin:24px 0 0;">
    <a href="https://rotahr.com${EQUIPMENT_LINK}" style="display:inline-block;background:#ff6b35;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;">
      Open the equipment register
    </a>
  </p>
  <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;line-height:1.5;">
    You get one of these 30 days out and again 7 days out. Log the service on the item
    and Rotahr rolls its next date forward automatically. Costs in the register are notes
    only — nothing is ever booked to your accounts.
  </p>
</div>`;

      const text = [
        "Equipment coming due",
        `${business.name} — advance notice`,
        "",
        ...list.map((p) => {
          const { headline, action } = phrasing(p.kind, p.days, p.dueDate);
          return `- ${p.assetName}: ${headline} — ${action}`;
        }),
        "",
        `https://rotahr.com${EQUIPMENT_LINK}`,
      ].join("\n");

      const res = await sendEmailQuiet({
        to,
        subject,
        html,
        text,
        context: "asset-reminders",
      });
      if (res.ok) emails++;
    }

    // Record last. If the send failed we would rather warn twice than never —
    // but only after the bell and email have both had their turn, so a crash
    // mid-loop cannot silently mark an unsent warning as sent.
    const created = await prisma.assetReminder.createMany({
      data: list.map((p) => ({
        businessId: p.businessId,
        assetId: p.assetId,
        kind: p.kind,
        stage: p.stage,
        dueDate: p.dueDate,
      })),
      skipDuplicates: true,
    });
    recorded += created.count;
  }

  return NextResponse.json({
    assets: assets.length,
    pending: pending.length,
    bells,
    emails,
    recorded,
    alreadySent,
    skippedNoManagers,
  });
}

export const GET = wrapCron("asset-reminders", __cronHandler as any);
