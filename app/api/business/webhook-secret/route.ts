import { NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { generateWebhookSecret, hashWebhookSecret } from "@/lib/webhooks/secret";
import { logActivity } from "@/lib/services/activity.service";

/**
 * Per-business secret for the inbound /api/webhooks endpoint.
 *
 * GET    → { configured: boolean }        (never returns the secret)
 * POST   → { secret }  generates or rotates; the plaintext is returned ONCE,
 *          only its SHA-256 is stored. Rotating invalidates the old secret.
 * DELETE → revokes; /api/webhooks then rejects everything for this business.
 */

async function guard() {
  const auth = await requireRole("ADMIN", "MANAGER");
  if (isResponse(auth)) return auth;
  if (!auth.user.businessId) {
    return NextResponse.json({ error: "No business" }, { status: 400 });
  }
  return auth as typeof auth & { user: { businessId: string } };
}

export async function GET() {
  const auth = await guard();
  if (isResponse(auth)) return auth;
  const b = await prisma.business.findUnique({
    where: { id: auth.user.businessId },
    select: { webhookSecretHash: true },
  });
  return NextResponse.json({ configured: !!b?.webhookSecretHash });
}

export async function POST() {
  const auth = await guard();
  if (isResponse(auth)) return auth;
  const secret = generateWebhookSecret();
  await prisma.business.update({
    where: { id: auth.user.businessId },
    data: { webhookSecretHash: hashWebhookSecret(secret) },
  });
  logActivity({
    businessId: auth.user.businessId,
    userId: auth.user.id,
    userName: auth.user.name || auth.user.email,
    action: "settings_changed",
    details: { setting: "webhook_secret", change: "rotated" },
  }).catch(() => {});
  return NextResponse.json({ secret });
}

export async function DELETE() {
  const auth = await guard();
  if (isResponse(auth)) return auth;
  await prisma.business.update({
    where: { id: auth.user.businessId },
    data: { webhookSecretHash: null },
  });
  logActivity({
    businessId: auth.user.businessId,
    userId: auth.user.id,
    userName: auth.user.name || auth.user.email,
    action: "settings_changed",
    details: { setting: "webhook_secret", change: "revoked" },
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
