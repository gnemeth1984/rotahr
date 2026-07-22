import OpenAI from 'openai';
import { put } from '@vercel/blob';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Generate a simple, on-brand cover image for an article and store it in Vercel Blob.
// Uses dall-e-3 (broadly available on any standard OpenAI API key) rather than
// gpt-image-1, which requires separate organization verification — every prior
// generation attempt was silently failing for exactly that reason, so every
// published post ended up with no cover image at all.
export async function generateCoverImage(title: string, category: string): Promise<string | null> {
  try {
    const img = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `Clean, modern editorial illustration for a hospitality industry blog article titled "${title}" (category: ${category}). Professional restaurant/bar/hotel setting relevant to the topic. Flat, minimal, premium SaaS blog cover style, warm neutral tones with a hint of amber/orange accent, no text or logos in the image, wide aspect ratio.`,
      size: '1792x1024',
      quality: 'standard',
      response_format: 'b64_json',
      n: 1,
    });
    const b64 = img.data?.[0]?.b64_json;
    if (!b64) {
      console.error('[Blog] Cover image generation returned no b64_json data');
      return null;
    }
    const buffer = Buffer.from(b64, 'base64');
    const blob = await put(`blog-covers/${slugify(title)}-${Date.now()}.png`, buffer, {
      access: 'public',
      contentType: 'image/png',
    });
    return blob.url;
  } catch (e: any) {
    console.error('[Blog] Cover image generation failed:', e?.message || e);
    return null;
  }
}
