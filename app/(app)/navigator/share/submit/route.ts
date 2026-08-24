import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { navigatorUserId } from "@/lib/navigator/guard";

export const dynamic = "force-dynamic";
// Only the blob write happens here, never the vision call — see below.
export const maxDuration = 30;

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/**
 * POST /navigator/share/submit — the Android share-sheet target.
 *
 * Registered in /navigator.webmanifest as share_target, so "Navigator" appears
 * in the OS share sheet and a photo, screenshot or link can go straight into
 * Capture without opening the app and finding the tab first.
 *
 * Lives under /navigator rather than /api on purpose: a share_target action
 * MUST sit inside the manifest's scope, and Navigator's manifest is scoped to
 * /navigator so it installs as its own app without dragging the whole of
 * Rotahr — and its share entry — onto every staff member's phone.
 *
 * Deliberately does NOT read the image here. The share sheet navigates the
 * browser to this URL, so anything slow leaves the phone staring at a blank
 * page for 20-60s. Instead: store the photo, redirect immediately to
 * /navigator/share, and let that page trigger the read with a spinner it can
 * actually show. A share that arrives is worth more than a share that is
 * already classified.
 *
 * Every response is a redirect, never JSON: this endpoint is reached by a form
 * navigation, so a JSON body would land the user on a page of raw text.
 */
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const userId = await navigatorUserId();

  // Navigator's manifest is scoped to /navigator, so in practice only its own
  // installed app can reach this. Belt and braces anyway: anyone else who
  // POSTs here goes somewhere sensible rather than a 403 they cannot act on.
  if (!userId) {
    return NextResponse.redirect(`${origin}/dashboard`, { status: 303 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.redirect(`${origin}/navigator/share?error=unreadable`, { status: 303 });
  }

  const file = form.get("file");
  const title = (form.get("title") as string | null)?.trim() || "";
  const text = (form.get("text") as string | null)?.trim() || "";
  const sharedUrl = (form.get("url") as string | null)?.trim() || "";

  // ---- A photo or screenshot: store it, hand off to the page for reading ----
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return NextResponse.redirect(`${origin}/navigator/share?error=toobig`, { status: 303 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.redirect(`${origin}/navigator/share?error=noblob`, { status: 303 });
    }

    const mimeType = ALLOWED.includes(file.type) ? file.type : "image/jpeg";
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const safeName = (file.name || "shared.jpg").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const blob = await put(`navigator-captures/${userId}/${Date.now()}-${safeName}`, bytes, {
        access: "private",
        contentType: mimeType,
      });

      const capture = await prisma.navCapture.create({
        data: { userId, blobUrl: blob.url, mimeType, status: "pending" },
      });

      return NextResponse.redirect(`${origin}/navigator/share?id=${capture.id}`, { status: 303 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "upload failed";
      return NextResponse.redirect(
        `${origin}/navigator/share?error=${encodeURIComponent(msg.slice(0, 120))}`,
        { status: 303 }
      );
    }
  }

  // ---- A link or plain text: becomes a task, not a capture ----------------
  // There is no image to read, so vision is the wrong tool. A shared article
  // or listing is nearly always "look at this later", which is a task.
  const link = sharedUrl || (text.match(/https?:\/\/\S+/)?.[0] ?? "");
  const label = title || (link ? link.replace(/^https?:\/\/(www\.)?/, "").slice(0, 70) : text.slice(0, 70));

  if (!label) {
    return NextResponse.redirect(`${origin}/navigator/share?error=empty`, { status: 303 });
  }

  const task = await prisma.navTask.create({
    data: {
      userId,
      title: label,
      notes: [text && text !== label ? text : null, link && link !== label ? link : null]
        .filter(Boolean)
        .join("\n\n") || null,
      status: "todo",
      priority: "later",
      project: link ? "Reading" : null,
    },
    select: { id: true },
  });

  return NextResponse.redirect(`${origin}/navigator/share?task=${task.id}`, { status: 303 });
}
