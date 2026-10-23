/**
 * POST /api/templates/lead { email, slug, format, consent, venueType, website }
 *
 * Called by the download form on /templates/<slug> before the file downloads.
 * Records the lead, then (only when TEMPLATE_EMAILS_ENABLED=1) emails them a
 * copy of the file — step 0 of the series in lib/templates/leads.ts.
 *
 * Fails open: the client downloads the file on anything but a 400, so a
 * database problem costs us a lead, never the visitor their template. If the
 * TemplateLead table is missing (migration not applied yet) the lead is parked
 * in ActivityLog as "template_lead_pending" and can be imported later with
 * scripts/import-pending-template-leads.ts.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getTemplate } from "@/lib/templates";
import { captureLead, normaliseLeadEmail, sendWelcomeNow } from "@/lib/templates/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMATS = new Set(["pdf", "xlsx", "csv"]);
/** New addresses per IP per day. Stops the form being used to mail-bomb someone. */
const MAX_NEW_PER_IP_PER_DAY = 10;

function hashIp(req: Request): string | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  if (!ip) return null;
  const salt = process.env.NEXTAUTH_SECRET || "rotahr-templates";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const slug = typeof body.slug === "string" ? body.slug : "";
  const format = typeof body.format === "string" && FORMATS.has(body.format) ? body.format : "pdf";
  if (!getTemplate(slug)) return NextResponse.json({ error: "Unknown template." }, { status: 400 });

  const email = normaliseLeadEmail(typeof body.email === "string" ? body.email : "");
  if (!email) return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });

  // Honeypot: real visitors never see or fill the "website" field.
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true, emailed: false });
  }

  const consent = body.consent === true;
  const venueType = typeof body.venueType === "string" ? body.venueType : null;
  const ipHash = hashIp(req);
  const country = req.headers.get("x-vercel-ip-country")?.toLowerCase().slice(0, 2) || null;
  const userAgent = req.headers.get("user-agent");

  // Same download stats the ungated beacon used to record.
  await prisma.activityLog
    .create({ data: { action: "template_download", details: { slug, format, gated: true } } })
    .catch(() => undefined);

  try {
    const known = await prisma.templateLead.findUnique({ where: { email }, select: { id: true } });
    if (!known && ipHash) {
      const recent = await prisma.templateLead.count({
        where: { ipHash, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });
      if (recent >= MAX_NEW_PER_IP_PER_DAY) {
        // Let them have the file; just don't store or mail yet another address.
        return NextResponse.json({ ok: true, emailed: false });
      }
    }
    const lead = await captureLead({ email, slug, consent, venueType, country, ipHash, userAgent });
    const emailed = await sendWelcomeNow(lead.id);
    return NextResponse.json({ ok: true, emailed });
  } catch (e) {
    console.error("[templates/lead] capture failed", e);
    await prisma.activityLog
      .create({
        data: {
          action: "template_lead_pending",
          details: { email, slug, consent, venueType, country, ipHash, at: new Date().toISOString() },
        },
      })
      .catch(() => undefined);
    return NextResponse.json({ ok: true, emailed: false });
  }
}
