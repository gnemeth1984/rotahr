import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET current settings (masked) — admins/managers only, this is sensitive config
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await prisma.messagingSettings.findUnique({ where: { businessId: session.user.businessId } });
  if (!settings) return NextResponse.json({ configured: false, enabled: false });

  return NextResponse.json({
    configured: true,
    enabled: settings.enabled,
    hasAccountSid: Boolean(settings.twilioAccountSid),
    hasAuthToken: Boolean(settings.twilioAuthToken),
    twilioWhatsappNumber: settings.twilioWhatsappNumber,
    twilioSmsNumber: settings.twilioSmsNumber,
  });
}

const saveSchema = z.object({
  twilioAccountSid: z.string().min(1),
  twilioAuthToken: z.string().min(1),
  twilioWhatsappNumber: z.string().optional().nullable(),
  twilioSmsNumber: z.string().optional().nullable(),
});

// POST saves credentials but always sets enabled:false — only the
// /api/messaging/test-credentials + explicit enable step can turn it on,
// so a bad/untested config can never silently appear "active" in the UI.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await prisma.messagingSettings.upsert({
    where: { businessId: session.user.businessId },
    create: {
      businessId: session.user.businessId,
      ...parsed.data,
      enabled: false,
    },
    update: {
      ...parsed.data,
      enabled: false, // any credential change re-locks it until re-verified
    },
  });

  return NextResponse.json({ success: true, enabled: false });
}
