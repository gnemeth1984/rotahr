import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { put } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024; // 12MB — a phone photo of an invoice, not a video

/**
 * POST /api/assets/upload  (multipart)
 *   file      — the photo or scan
 *   assetId   — required, ownership checked before the upload happens
 *   serviceId — optional, attaches the file to one engineer visit
 *   kind      — warranty | invoice | service_report | manual | photo | other
 *
 * Writes to the PRIVATE blob store. The returned payload contains the doc id,
 * never the blob url: the client reads files back through /api/assets/doc?id=,
 * which re-proves ownership. Handing out a blob url would make a warranty scan
 * readable by anyone who saw the link.
 *
 * No AI runs here. Unlike a receipt, nothing needs extracting — the manager is
 * already filling the fields in front of them, and a vision call would add
 * 20 seconds and a bill for no gain.
 */
export async function POST(req: NextRequest) {
  const session = await requirePermission("assets");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "File storage is not configured" }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const assetId = String(form.get("assetId") ?? "");
  const serviceIdRaw = String(form.get("serviceId") ?? "");
  const kind = String(form.get("kind") ?? "other");

  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is larger than 12MB" }, { status: 413 });
  }

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, businessId },
    select: { id: true },
  });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A serviceId from the client must belong to the same asset, or a file could
  // be pinned onto another business's visit.
  let serviceId: string | null = null;
  if (serviceIdRaw) {
    const svc = await prisma.assetService.findFirst({
      where: { id: serviceIdRaw, assetId, businessId },
      select: { id: true },
    });
    if (!svc) return NextResponse.json({ error: "Service visit not found" }, { status: 404 });
    serviceId = svc.id;
  }

  const safeName = (file.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);

  try {
    const blob = await put(`assets/${businessId}/${assetId}/${Date.now()}-${safeName}`, file, {
      access: "private",
    });

    const doc = await prisma.assetDoc.create({
      data: {
        businessId,
        assetId,
        serviceId,
        kind,
        blobUrl: blob.url,
        mimeType: file.type || null,
        fileName: file.name || safeName,
        sizeBytes: file.size,
        uploadedById: session.user.id,
      },
      select: { id: true, kind: true, fileName: true, mimeType: true, serviceId: true, createdAt: true },
    });

    return NextResponse.json({ doc }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
