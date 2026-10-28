/**
 * Where a browser should load a tutorial video from.
 *
 * Rotahr's Vercel Blob store is PRIVATE (every blob lives on
 * <store>.private.blob.vercel-storage.com and needs the read-write token to
 * read). A private blob URL can't go in a <video src>, so playback goes
 * through /api/tutorials/video/<id>, which streams it with Range support
 * (seeking works). A legacy public blob URL is used directly.
 */
export const TUTORIAL_BLOB_ACCESS = "private" as const;

export function isPrivateBlobUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.private\.blob\.vercel-storage\.com\//i.test(url);
}

/** Only URLs in a Vercel Blob store (public or private) are accepted on save. */
export function isOurBlobUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.(public|private)\.blob\.vercel-storage\.com\//i.test(url);
}

export function tutorialPlaybackPath(t: { id: string; videoUrl: string }): string {
  return isPrivateBlobUrl(t.videoUrl) ? `/api/tutorials/video/${encodeURIComponent(t.id)}` : t.videoUrl;
}
