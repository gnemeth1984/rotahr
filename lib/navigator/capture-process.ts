/**
 * Navigator capture — the persist half.
 *
 * Extracted so there is exactly ONE place that turns a reading into rows.
 * Three callers need it now (direct upload from the Capture tab, a share-sheet
 * drop, and a retry of a failed read) and the rules that matter — notes become
 * "todo" not "draft", documents land in the Admin project, a receipt never
 * becomes an Expense — must not drift between them.
 */

import { prisma } from "@/lib/db";
import { readCapture } from "./capture";
import { todayKey } from "./dates";

/** Midday, so no timezone ever slips the date back a day. */
export function dateOrNull(key: string | null): Date | null {
  if (!key) return null;
  const d = new Date(`${key}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const BLOB_FETCH_TIMEOUT_MS = 15_000;

/**
 * Pull a stored capture's bytes back out of the private blob store.
 * Used when the read is deferred or retried, so the photo is already saved.
 */
export async function fetchCaptureBytes(blobUrl: string): Promise<Buffer> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Blob storage is not configured");

  const res = await fetch(blobUrl, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(BLOB_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Could not re-read the stored photo (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export type ProcessResult = {
  capture: Awaited<ReturnType<typeof prisma.navCapture.update>>;
  tasksCreated: number;
  readFailed?: boolean;
  error?: string;
};

/**
 * Read an already-stored capture and write what it found onto the row.
 *
 * Never throws for a bad reading: a failed vision call marks the row "failed"
 * and returns readFailed, because the photo genuinely IS saved and the honest
 * UI is a row with a retry button rather than an error page.
 */
export async function processCapture(args: {
  userId: string;
  captureId: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<ProcessResult> {
  const { userId, captureId, bytes, mimeType } = args;

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

    const capture = await prisma.navCapture.update({
      where: { id: captureId },
      data: {
        kind: reading.kind,
        status: "done",
        error: null,
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

    return { capture, tasksCreated: taskIds.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not read the image";
    const capture = await prisma.navCapture.update({
      where: { id: captureId },
      data: { status: "failed", error: msg.slice(0, 500), title: "Could not read this one" },
    });
    return { capture, tasksCreated: 0, readFailed: true, error: msg };
  }
}
