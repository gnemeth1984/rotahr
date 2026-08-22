// Navigator long-term memory: the user's own view of what it claims to know.
//
// This surface exists because extraction writes without asking. Anything the
// model stores on its own must be visible and correctable here, or the store
// quietly drifts away from the truth and nothing on screen ever says so.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { saveMemory, forgetMemory, MEMORY_KINDS } from "@/lib/navigator/memory";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET — everything remembered, newest first. Forgotten rows are included only
// when asked for, so the user can audit a wrong auto-extraction after the fact.
export async function GET(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const includeForgotten = req.nextUrl.searchParams.get("forgotten") === "1";

  const rows = await prisma.navMemory.findMany({
    where: { userId, ...(includeForgotten ? {} : { forgotten: false }) },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: 400,
    select: {
      id: true,
      kind: true,
      key: true,
      value: true,
      subject: true,
      source: true,
      pinned: true,
      forgotten: true,
      useCount: true,
      lastUsedAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(rows);
}

const postSchema = z.object({
  kind: z.enum(MEMORY_KINDS).optional(),
  key: z.string().min(1).max(120),
  value: z.string().min(1).max(2000),
  subject: z.string().max(120).nullable().optional(),
  pinned: z.boolean().optional(),
});

// POST — add or correct a memory by hand. Same key + kind updates in place, so
// fixing a wrong value never leaves the old one behind to be retrieved.
export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const saved = await saveMemory(userId, { ...parsed.data, source: "manual" });
  if (!saved) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });

  return NextResponse.json(saved);
}

const patchSchema = z.object({
  id: z.string().min(1),
  pinned: z.boolean().optional(),
  // Un-forgetting is deliberate: a soft flag is only useful if it is reversible.
  forgotten: z.boolean().optional(),
});

// PATCH — pin/unpin, or restore something forgotten.
export async function PATCH(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { id, ...data } = parsed.data;
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });

  const r = await prisma.navMemory.updateMany({ where: { id, userId }, data });
  if (!r.count) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

// DELETE — soft. The model stops seeing it immediately; the row stays so a bad
// auto-extraction can still be inspected instead of vanishing without trace.
export async function DELETE(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const n = await forgetMemory(userId, { id });
  if (!n) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
