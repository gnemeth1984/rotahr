// @ts-nocheck
/**
 * Admin founding member programme — /api/admin/founding
 *
 * GET    list applications, current founding members and the spot count
 * POST   grant a founding spot to a business  { businessId, applicationId? }
 * PATCH  update an application               { applicationId, status?, adminNote? }
 * DELETE revoke a founding spot              { businessId }
 *
 * Platform admin only, same guard as /api/admin/businesses.
 *
 * A grant deliberately writes nothing new into the access model: lsPlan = "pro"
 * and trialEndsAt = now + 12 months is a state lib/billing/access.ts already
 * handles correctly, so there is no second code path to keep in sync.
 *
 * A revoke clears the founding flag and LEAVES BILLING ALONE. Setting
 * trialEndsAt to now would drop a live venue into read-only mid-service, which
 * is not something an admin should be able to do by accident from a list view.
 * If the free year genuinely needs to end early, change the trial date
 * explicitly instead.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { revalidateTag } from "next/cache";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";
import {
  GRANTED_PLAN,
  TOTAL_SPOTS,
  foundingEndsAt,
} from "@/lib/marketing/founding";

const STATUSES = ["new", "contacted", "granted", "declined", "withdrawn"];

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  try {
    const [applications, members] = await Promise.all([
      prisma.foundingApplication.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.business.findMany({
        where: { foundingMember: true },
        orderBy: { foundingGrantedAt: "desc" },
        select: {
          id: true,
          name: true,
          foundingGrantedAt: true,
          trialEndsAt: true,
          lsPlan: true,
          lsStatus: true,
          createdAt: true,
          _count: { select: { users: true, employees: true } },
        },
      }),
    ]);

    return NextResponse.json({
      applications,
      members,
      total: TOTAL_SPOTS,
      taken: members.length,
      remaining: Math.max(0, TOTAL_SPOTS - members.length),
    });
  } catch (err) {
    console.error("[admin/founding GET]", err);
    return NextResponse.json({ error: "Could not load." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const businessId = typeof body.businessId === "string" ? body.businessId : "";
  const applicationId =
    typeof body.applicationId === "string" ? body.applicationId : null;

  if (!businessId) {
    return NextResponse.json({ error: "businessId is required." }, { status: 400 });
  }

  try {
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, foundingMember: true },
    });
    if (!biz) {
      return NextResponse.json({ error: "No such business." }, { status: 404 });
    }
    if (biz.foundingMember) {
      return NextResponse.json(
        { error: `${biz.name} is already a founding member.` },
        { status: 409 },
      );
    }

    const endsAt = foundingEndsAt();
    const updated = await prisma.business.update({
      where: { id: businessId },
      data: {
        foundingMember: true,
        foundingGrantedAt: new Date(),
        lsPlan: GRANTED_PLAN,
        trialEndsAt: endsAt,
      },
      select: { id: true, name: true, trialEndsAt: true },
    });

    if (applicationId) {
      await prisma.foundingApplication
        .update({
          where: { id: applicationId },
          data: { status: "granted", grantedBusinessId: businessId },
        })
        .catch((e) => console.error("[admin/founding] link application", e));
    }

    revalidateTag("founding");
    return NextResponse.json({ ok: true, business: updated });
  } catch (err) {
    console.error("[admin/founding POST]", err);
    return NextResponse.json({ error: "Could not grant that." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const applicationId =
    typeof body.applicationId === "string" ? body.applicationId : "";
  if (!applicationId) {
    return NextResponse.json({ error: "applicationId is required." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    data.status = body.status;
  }
  if (typeof body.adminNote === "string") {
    data.adminNote = body.adminNote.slice(0, 4000) || null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const application = await prisma.foundingApplication.update({
      where: { id: applicationId },
      data,
    });
    return NextResponse.json({ ok: true, application });
  } catch (err) {
    console.error("[admin/founding PATCH]", err);
    return NextResponse.json({ error: "Could not update." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const businessId = typeof body.businessId === "string" ? body.businessId : "";
  if (!businessId) {
    return NextResponse.json({ error: "businessId is required." }, { status: 400 });
  }

  try {
    // Billing is intentionally untouched — see the note at the top of this file.
    const updated = await prisma.business.update({
      where: { id: businessId },
      data: { foundingMember: false, foundingGrantedAt: null },
      select: { id: true, name: true, trialEndsAt: true },
    });
    revalidateTag("founding");
    return NextResponse.json({
      ok: true,
      business: updated,
      note: "Founding flag cleared. Plan and trial date were left as they were.",
    });
  } catch (err) {
    console.error("[admin/founding DELETE]", err);
    return NextResponse.json({ error: "Could not revoke." }, { status: 500 });
  }
}
