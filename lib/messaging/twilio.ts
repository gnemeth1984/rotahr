import Twilio from "twilio";
import { prisma } from "@/lib/prisma";

interface SendResult {
  success: boolean;
  sid?: string;
  error?: string;
}

async function getClientForBusiness(businessId: string) {
  const settings = await prisma.messagingSettings.findUnique({ where: { businessId } });
  if (!settings?.enabled || !settings.twilioAccountSid || !settings.twilioAuthToken) {
    return null;
  }
  return { client: Twilio(settings.twilioAccountSid, settings.twilioAuthToken), settings };
}

export async function sendWhatsApp(
  businessId: string,
  toPhone: string,
  body: string
): Promise<SendResult> {
  const ctx = await getClientForBusiness(businessId);
  if (!ctx || !ctx.settings.twilioWhatsappNumber) {
    return { success: false, error: "WhatsApp messaging not configured for this business" };
  }
  try {
    const msg = await ctx.client.messages.create({
      from: ctx.settings.twilioWhatsappNumber,
      to: `whatsapp:${toPhone}`,
      body,
    });
    return { success: true, sid: msg.sid };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to send WhatsApp message" };
  }
}

export async function sendSms(
  businessId: string,
  toPhone: string,
  body: string
): Promise<SendResult> {
  const ctx = await getClientForBusiness(businessId);
  if (!ctx || !ctx.settings.twilioSmsNumber) {
    return { success: false, error: "SMS messaging not configured for this business" };
  }
  try {
    const msg = await ctx.client.messages.create({
      from: ctx.settings.twilioSmsNumber,
      to: toPhone,
      body,
    });
    return { success: true, sid: msg.sid };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to send SMS" };
  }
}

/** Used by the settings page to verify real credentials work before enabling. */
export async function testCredentials(
  accountSid: string,
  authToken: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = Twilio(accountSid, authToken);
    await client.api.v2010.accounts(accountSid).fetch();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Invalid Twilio credentials" };
  }
}
