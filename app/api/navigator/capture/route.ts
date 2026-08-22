import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { readCapture, type CaptureKind } from "@/lib/navigator/capture";
import { todayKey } from "@/lib/navigator/dates";

export const dynamic = "force-dynamic";
// Vision on a "high" detail photo is the slow part — a dark handwritten note
// can take 20s+. 60s is the ceiling on the Vercel plan.
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024; // phone photos land at 2-5MB; 12 is generous
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function dateOrNull(key: string | null): Date | null {
  if (!key) return null;
  const d = new Date(`${key}T12:00:00.000Z`); // midday, so no timezone slips a day
  return Number.isNaN(d.getTime()) ? null : d;
}

// GET — recent captures, newest first
export async function GET(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const kind = req.nextUrl.searchParams.get("kind");
  const take = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 30, 1), 100);

  const rows = await prisma.navCapture.findMany({
    where: { userId, ...(kind && kind !== "all" ? { kind } : {}) },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json(rows);
}

// POST — multipart image upload, read it, save what it found
export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob storage is not configured" }, { status: 500 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Could not read the upload" }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That image is over 12MB — try again, it will compress" }, { status: 413 });
  }

  const mimeType = ALLOWED.includes(file.type) ? file.type : "image/jpeg";
  const bytes = Buffer.from(await file.arrayBuffer());

  // Store the photo FIRST, in its own row, before any AI runs. A vision
  // timeout then costs the reading, not the photo — he can retry the read
  // instead of being asked to find the letter and shoot it again.
  const safeName = (file.name || "capture.jpg").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  let blobUrl: string;
  try {
    const blob = await put(`navigator-captures/${userId}/${Date.now()}-${safeName}`, bytes, {
      access: "private",
      contentType: mimeType,
    });
    blobUrl = blob.url;
  } catch (e) {
    return NextResponse.json(
      { error: `Upload failed: ${e instanceof Error ? e.message : "storage error"}` },
      { status: 502 }
    );
  }

  const capture = await prisma.navCapture.create({
    data: { userId, blobUrl, mimeType, status: "pending" },
  });

  // ---- Read it ------------------------------------------------------------
  try {
    const reading = await readCapture(bytes.toString("base64"), mimeType, todayKey());

    // Notes and documents become real tasks. Captured as "todo", not "draft":
    // he pointed a camera at it on purpose, which is triage enough — a draft
    // would be invisible and the capture would achieve nothing.
    let taskIds: string[] = [];
    if (reading.tasks.length) {
      const created = await prisma.$transaction(
        reading.tasks.map((t) =>
          prisma.navTask.create({
            data: {
              userId,
              title: t.title,
              notes: t.notes ?? null,
              status: "todo",
              priority: t.priority ?? "important",
              effortMins: t.effortMins ?? null,
              dueDate: dateOrNull(t.due ?? null),
              project: reading.kind === "document" ? "Admin" : null,
            },
            select: { id: true },
          })
        )
      );
      taskIds = created.map((c) => c.id);
    }

    const saved = await prisma.navCapture.update({
      where: { id: capture.id },
      data: {
        kind: reading.kind,
        status: "done",
        title: reading.title,
        summary: reading.summary,
        rawText: reading.rawText,
        vendor: reading.vendor,
        total: reading.total,
        currency: reading.currency,
        docDate: dateOrNull(reading.docDate),
        deadline: dateOrNull(reading.deadline),
        extracted: reading.lineItems.length ? { lineItems: reading.lineItems } : undefined,
        taskIds,
      },
    });

    return NextResponse.json({ capture: saved, tasksCreated: taskIds.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not read the image";
    const saved = await prisma.navCapture.update({
      where: { id: capture.id },
      data: { status: "failed", error: msg.slice(0, 500), title: "Could not read this one" },
    });
    // 200, not 5xx: the photo IS saved and listed. The client shows the row
    // with a retry, which is the honest state of things.
    return NextResponse.json({ capture: saved, tasksCreated: 0, readFailed: true, error: msg });
  }
}

// PATCH — fix the kind by hand, or retry a failed read
export async function PATCH(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.navCapture.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const kind = body?.kind as CaptureKind | undefined;
  if (kind && ["receipt", "note", "document", "unknown"].includes(kind)) {
    const updated = await prisma.navCapture.update({ where: { id }, data: { kind } });
    return NextResponse.json({ capture: updated });
  }

  return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
}

// DELETE — drop a capture. Unlike memory, this is a real delete: a photo of a
// personal document is exactly the thing that should actually go when asked.
export async function DELETE(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.navCapture.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.navCapture.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
