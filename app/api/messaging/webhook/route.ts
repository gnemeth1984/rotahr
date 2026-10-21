import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Twilio status callbacks and inbound SMS/WhatsApp messages
 * (application/x-www-form-urlencoded).
 *
 * Security model:
 *  1. Resolve the tenant from the payload: AccountSid must match a business's
 *     MessagingSettings, and one of To/From must be that business's Twilio
 *     number. (Several tenants may share one Twilio account; the number
 *     disambiguates.)
 *  2. Verify X-Twilio-Signature with THAT tenant's auth token. Unsigned or
 *     mis-signed requests get 403 and change nothing.
 *  3. Every read/write is scoped to the resolved businessId.
 *
 * Previously there was no signature check, status updates matched on SID
 * across all tenants, and inbound replies were attached to whichever tenant's
 * customer happened to have that phone number first.
 */

function stripChannel(n: string | undefined | null): string {
  return (n ?? "").replace(/^whatsapp:/, "").replace(/\s+/g, "");
}

/** Twilio signs the exact public URL it called. Behind Vercel's proxy req.url
 *  can differ (host/proto), so try the plausible public forms. */
function candidateUrls(req: NextRequest): string[] {
  const url = new URL(req.url);
  const path = url.pathname + url.search;
  const out = new Set<string>([req.url]);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (host) out.add(`${proto}://${host}${path}`);
  for (const base of [process.env.TWILIO_WEBHOOK_BASE_URL, process.env.NEXTAUTH_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    if (base) out.add(base.replace(/\/+$/, "") + path);
  }
  return [...out];
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") params[k] = v;
  });

  const accountSid = params.AccountSid;
  const to = stripChannel(params.To);
  const from = stripChannel(params.From);
  if (!accountSid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const candidates = await prisma.messagingSettings.findMany({
    where: { twilioAccountSid: accountSid, twilioAuthToken: { not: null } },
    select: {
      businessId: true,
      twilioAuthToken: true,
      twilioSmsNumber: true,
      twilioWhatsappNumber: true,
    },
  });

  const ownNumber = (s: (typeof candidates)[number]) =>
    [s.twilioSmsNumber, s.twilioWhatsappNumber].map(stripChannel).filter(Boolean);

  // Prefer tenants whose number appears in this message; fall back to the
  // only tenant on the account (e.g. number changed in Twilio but not here).
  let matches = candidates.filter((s) => {
    const nums = ownNumber(s);
    return nums.includes(to) || nums.includes(from);
  });
  if (matches.length === 0 && candidates.length === 1) matches = candidates;

  const urls = candidateUrls(req);
  const tenant = matches.find(
    (s) => s.twilioAuthToken && urls.some((u) => twilio.validateRequest(s.twilioAuthToken!, signature, u, params))
  );
  if (!tenant) {
    console.warn("[twilio webhook] rejected: no tenant / bad signature", { accountSid, matches: matches.length });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const businessId = tenant.businessId;

  const messageSid = params.MessageSid || params.SmsSid;
  const messageStatus = params.MessageStatus || params.SmsStatus; // queued|sent|delivered|failed|undelivered|received
  const bodyText = params.Body;

  if (!messageSid) return NextResponse.json({ ok: true });

  // Inbound messages also carry SmsStatus=received — only treat it as a status
  // update when there's no Body.
  if (messageStatus && !bodyText) {
    await prisma.guestMessage.updateMany({
      where: { providerSid: messageSid, businessId },
      data: { status: messageStatus },
    });
    return NextResponse.json({ ok: true });
  }

  if (params.From && bodyText) {
    // Inbound reply from a guest of THIS business only.
    const customer = await prisma.customer.findFirst({
      where: { businessId, phone: from, isAnonymised: false },
      select: { id: true },
    });
    if (customer) {
      const dupe = await prisma.guestMessage.findFirst({
        where: { businessId, providerSid: messageSid },
        select: { id: true },
      });
      if (!dupe) {
        await prisma.guestMessage.create({
          data: {
            businessId,
            customerId: customer.id,
            channel: params.From.startsWith("whatsapp:") ? "whatsapp" : "sms",
            direction: "inbound",
            body: bodyText.slice(0, 5000),
            status: "received",
            providerSid: messageSid,
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
