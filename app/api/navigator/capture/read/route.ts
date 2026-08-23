import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { processCapture, fetchCaptureBytes } from "@/lib/navigator/capture-process";

export const dynamic = "force-dynamic";
// Same ceiling as the upload route — vision on a dark handwritten note is slow.
export const maxDuration = 60;

/**
 * POST /api/navigator/capture/read  { id }
 *
 * Reads a capture whose photo is ALREADY stored. Two callers:
 *   - the share-sheet flow, which saves the photo fast, redirects, and then
 *     reads it from the page so the OS share sheet never hangs on a spinner
 *   - a retry of a read that failed the first time
 *
 * Idempotent enough to be safe on a double tap: a re-read overwrites the same
 * row. It does create a fresh set of tasks, so the client only offers it for
 * pending/failed rows.
 */
export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.navCapture.findFirst({
    where: { id, userId },
    select: { id: true, blobUrl: true, mimeType: true, taskIds: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await fetchCaptureBytes(existing.blobUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load the stored photo";
    await prisma.navCapture.update({
      where: { id },
      data: { status: "failed", error: msg.slice(0, 500) },
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // A previous attempt may have already spawned tasks. Clear them so a retry
  // does not leave two copies of the same handwritten to-do list behind.
  if (existing.taskIds.length) {
    await prisma.navTask
      .deleteMany({ where: { userId, id: { in: existing.taskIds }, status: "todo" } })
      .catch(() => null);
  }

  const result = await processCapture({
    userId,
    captureId: existing.id,
    bytes,
    mimeType: existing.mimeType,
  });

  return NextResponse.json({
    capture: result.capture,
    tasksCreated: result.tasksCreated,
    ...(result.readFailed ? { readFailed: true, error: result.error } : {}),
  });
}
