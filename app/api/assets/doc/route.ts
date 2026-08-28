import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET    /api/assets/doc?id=<docId>  → streams a warranty scan / invoice / photo
 * DELETE /api/assets/doc?id=<docId>  → detaches the doc row
 *
 * Takes a doc id, NEVER a blob url — same rule as Navigator's
 * capture/image route and speak route. A url param would let any signed-in
 * manager name an arbitrary object in our private store; these are other
 * businesses' purchase invoices. The row is looked up scoped to businessId, so
 * ownership is proven before a single byte moves.
 */
export async function GET(req: NextRequest) {
  const session = await requirePermission("assets");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const doc = await prisma.assetDoc.findFirst({
    where: { id, businessId },
    select: { blobUrl: true, mimeType: true, fileName: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: "File storage is not configured" }, { status: 500 });

  try {
    const res = await fetch(doc.blobUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      return NextResponse.json({ error: `File fetch failed (${res.status})` }, { status: res.status });
    }
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? doc.mimeType ?? "application/octet-stream",
        // inline so a phone opens the image rather than downloading it
        "Content-Disposition": `inline; filename="${(doc.fileName ?? "file").replace(/"/g, "")}"`,
        // private: a purchase invoice must never sit in a shared cache
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "File fetch failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requirePermission("assets");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const doc = await prisma.assetDoc.findFirst({ where: { id, businessId }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.assetDoc.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
