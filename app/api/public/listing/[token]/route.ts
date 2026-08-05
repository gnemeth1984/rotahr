import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import {
  findByManageToken,
  publishListing,
  updateListing,
} from "@/lib/public-page/self-list";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Manage a self-service listing using only the manage token.
 *
 * There is no session here by design. Requiring an account to edit a free
 * listing would kill the conversion the listing exists to create, so possession
 * of the emailed token is the credential - the same model as the claim link. The
 * token is rotated on every send and the route is never indexed.
 *
 * Every handler re-resolves the token, so a listing that has since been
 * converted into a real account (users > 0) stops being editable this way and
 * falls under normal authenticated permissions instead.
 */

async function resolve(token: string) {
  const listing = await findByManageToken(token);
  if (!listing) return null;
  return listing;
}

const notFound = () =>
  NextResponse.json({ error: "This link is no longer valid." }, { status: 404 });

/** GET - load the listing, and publish it, since opening the link proves the mailbox. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const listing = await resolve(token);
  if (!listing) return notFound();

  if (!listing.live) await publishListing(listing.id);
  return NextResponse.json({ listing: { ...listing, live: true } });
}

/** PATCH - save owner edits. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const listing = await resolve(token);
  if (!listing) return notFound();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const pick = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : undefined);

  const updated = await updateListing(listing.id, {
    tagline: pick("tagline"),
    about: pick("about"),
    address: pick("address"),
    phone: pick("phone"),
    website: pick("website"),
  });
  if (!updated) return notFound();

  return NextResponse.json({ listing: updated });
}

/** POST - upload or replace the cover photo. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const listing = await resolve(token);
  if (!listing) return notFound();

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "That file isn't an image." }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Photo must be under 8MB." }, { status: 400 });
    }

    // The blob store is private-only, so the saved URL is served through
    // /api/public/venue-image (publicImageSrc handles the rewrite on render).
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-60);
    const blob = await put(`venue-covers/${listing.id}/${Date.now()}-${safeName}`, file, {
      access: "private",
      contentType: file.type,
    });

    const updated = await updateListing(listing.id, { heroImage: blob.url });
    if (!updated) return notFound();

    // Publish on first upload too - an owner who uploads a photo has clearly
    // proven the mailbox, and leaving the page dark at that point is a bug.
    if (!listing.live) await publishListing(listing.id);

    return NextResponse.json({ listing: { ...updated, live: true } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[listing] cover upload failed:", msg);
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
}
