import { put } from '@vercel/blob';

export function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Generate a simple, on-brand cover image for an article and store it in Vercel Blob.
// Uses Pollinations.ai — a free, keyless image generation API (no OpenAI billing/org
// verification needed). Every prior OpenAI-based attempt (gpt-image-1, then dall-e-3)
// silently failed for every one of the 46 published posts, so cover images went live
// with none at all. Pollinations needs no API key and no account, which removes that
// whole failure class.
export async function generateCoverImage(
  title: string,
  category: string,
  opts?: { rethrow?: boolean }
): Promise<string | null> {
  try {
    const prompt = `Clean, modern flat editorial illustration for a hospitality industry blog article titled "${title}" (category: ${category}). Professional restaurant/bar/hotel setting relevant to the topic. Minimal, premium SaaS blog cover style, warm neutral tones with a hint of amber/orange accent, no text or logos in the image, wide aspect ratio.`;

    // Deterministic-ish seed from the title so re-runs for the same post are stable,
    // while different posts still get different images.
    const seed = Math.abs(
      [...slugify(title)].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7)
    );

    const url =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
      `?width=1792&height=1024&nologo=true&seed=${seed}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) {
      console.error(`[Blog] Pollinations image fetch failed: ${res.status}`);
      return null;
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength < 1000) {
      console.error('[Blog] Pollinations returned a suspiciously small image, skipping');
      return null;
    }

    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const blob = await put(`blog-covers/${slugify(title)}-${Date.now()}.${ext}`, buffer, {
      access: 'public',
      contentType,
    });
    return blob.url;
  } catch (e: any) {
    console.error('[Blog] Cover image generation failed:', e?.message || e);
    if (opts?.rethrow) throw e;
    return null;
  }
}
