// @ts-nocheck
/**
 * Tutorial video library admin CRUD — /api/admin/tutorials
 *
 * GET    list every tutorial, published or not, in display order
 * POST   create a row after the browser finished uploading to Blob
 * PATCH  edit fields, toggle published, or move a row up/down
 * DELETE remove the row AND the blob behind it
 *
 * Platform admin only (Gabor). Business owners with role ADMIN must never
 * reach this - the library is Rotahr's own, not per-tenant.
 *
 * Note this file exports only route handlers. Next.js rejects a route module
 * that exports arbitrary consts, which is why CATEGORIES sits here unexported
 * and the client keeps its own copy.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";
import { isOurBlobUrl } from "@/lib/tutorials/playback";

async function guard() {
  const session = await getServerSession(authOptions);
  if (!isSuperAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function slugify(text: string): string {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/^-|-$/g, "");
}

/** Slugs are unique, so a clash has to resolve rather than 500 on the admin. */
async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = base || "tutorial";
  let candidate = root;
  for (let i = 2; i < 60; i++) {
    const existing = await prisma.tutorial.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  const tutorials = await prisma.tutorial.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ tutorials });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const videoUrl = String(body.videoUrl || "").trim();

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!videoUrl) return NextResponse.json({ error: "Video URL is required" }, { status: 400 });

  // Only accept URLs we actually put there. Stops a malformed client - or a
  // copy/pasted third party link - from ending up embedded on a public page.
  // Our store is private (<store>.private.blob...), so both kinds are allowed.
  if (!isOurBlobUrl(videoUrl)) {
    return NextResponse.json(
      { error: "Video URL must be a Vercel Blob URL" },
      { status: 400 }
    );
  }

  const last = await prisma.tutorial.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const tutorial = await prisma.tutorial.create({
    data: {
      title,
      slug: await uniqueSlug(slugify(title)),
      description: String(body.description || "").trim(),
      category: String(body.category || "general").trim() || "general",
      videoUrl,
      posterUrl: body.posterUrl ? String(body.posterUrl) : null,
      durationSeconds: Number.isFinite(Number(body.durationSeconds))
        ? Math.round(Number(body.durationSeconds))
        : null,
      fileSizeBytes: Number.isFinite(Number(body.fileSizeBytes))
        ? Math.round(Number(body.fileSizeBytes))
        : null,
      sortOrder: (last?.sortOrder ?? 0) + 10,
      // Draft by default so a half-described video is never live the instant
      // the upload finishes.
      published: false,
    },
  });

  revalidatePath("/tutorials");
  return NextResponse.json({ tutorial });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const current = await prisma.tutorial.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reorder: swap sortOrder with the neighbour in that direction. Swapping two
  // rows rather than renumbering the list keeps this a two row write and means
  // a failed request cannot leave the order half applied.
  if (body.move === "up" || body.move === "down") {
    const neighbour = await prisma.tutorial.findFirst({
      where:
        body.move === "up"
          ? { sortOrder: { lt: current.sortOrder } }
          : { sortOrder: { gt: current.sortOrder } },
      orderBy: { sortOrder: body.move === "up" ? "desc" : "asc" },
    });
    if (neighbour) {
      await prisma.$transaction([
        prisma.tutorial.update({
          where: { id: current.id },
          data: { sortOrder: neighbour.sortOrder },
        }),
        prisma.tutorial.update({
          where: { id: neighbour.id },
          data: { sortOrder: current.sortOrder },
        }),
      ]);
    }
    revalidatePath("/tutorials");
    return NextResponse.json({ ok: true });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) {
    data.title = body.title.trim();
    data.slug = await uniqueSlug(slugify(body.title), id);
  }
  if (typeof body.description === "string") data.description = body.description.trim();
  if (typeof body.category === "string" && body.category.trim()) data.category = body.category.trim();
  if (typeof body.published === "boolean") data.published = body.published;
  if (body.posterUrl === null || typeof body.posterUrl === "string") {
    data.posterUrl = body.posterUrl || null;
  }
  if (Number.isFinite(Number(body.durationSeconds))) {
    data.durationSeconds = Math.round(Number(body.durationSeconds));
  }

  const tutorial = await prisma.tutorial.update({ where: { id }, data });
  revalidatePath("/tutorials");
  return NextResponse.json({ tutorial });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const tutorial = await prisma.tutorial.findUnique({ where: { id } });
  if (!tutorial) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete the row first. If the blob delete fails we are left with an orphan
  // file costing pennies; the other order leaves a live page pointing at a
  // video that 404s, which is the worse failure.
  await prisma.tutorial.delete({ where: { id } });
  try {
    await del(tutorial.videoUrl);
    if (tutorial.posterUrl) await del(tutorial.posterUrl);
  } catch {
    // Orphaned blob. Not worth failing the request over.
  }

  revalidatePath("/tutorials");
  return NextResponse.json({ ok: true });
}
