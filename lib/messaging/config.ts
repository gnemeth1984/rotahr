import { prisma } from "@/lib/prisma";

/**
 * Guest messaging (WhatsApp/SMS) is a real, working integration but must stay
 * fully invisible to end users until a business has valid Twilio credentials
 * saved AND `enabled` is explicitly flipped on (only ever set true after a
 * live test message send succeeds — see /api/messaging/test-send).
 *
 * Never surface a "Send WhatsApp" button or any messaging UI unless this
 * returns configured:true for that business. This prevents shipping a
 * half-working feature that looks live but silently fails.
 */
export async function getMessagingStatus(businessId: string): Promise<{
  configured: boolean;
  hasWhatsapp: boolean;
  hasSms: boolean;
}> {
  const settings = await prisma.messagingSettings.findUnique({ where: { businessId } });

  if (!settings || !settings.enabled || !settings.twilioAccountSid || !settings.twilioAuthToken) {
    return { configured: false, hasWhatsapp: false, hasSms: false };
  }

  return {
    configured: true,
    hasWhatsapp: Boolean(settings.twilioWhatsappNumber),
    hasSms: Boolean(settings.twilioSmsNumber),
  };
}
