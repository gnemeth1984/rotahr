// Loads static Google Font files (woff) at request time for use with next/og ImageResponse.
// Uses the classic "old Safari" User-Agent trick so Google serves plain .woff files
// (instead of woff2) which @vercel/og / satori can embed directly.
// Results are cached per server instance to avoid refetching on every request.

const OLD_SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15";

type FontWeight = 400 | 500 | 600 | 700 | 800 | 900;

const cache = new Map<string, Promise<ArrayBuffer>>();

async function fetchWoffBytes(family: string, weight: FontWeight, italic: boolean): Promise<ArrayBuffer> {
  const key = `${family}:${weight}:${italic ? "i" : "n"}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const axis = italic ? `ital,wght@1,${weight}` : `ital,wght@0,${weight}`;
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:${axis}&display=swap`;
    const cssRes = await fetch(cssUrl, { headers: { "User-Agent": OLD_SAFARI_UA } });
    if (!cssRes.ok) throw new Error(`Google Fonts CSS fetch failed for ${family}: ${cssRes.status}`);
    const css = await cssRes.text();

    // Grab the "latin" subset block's src url — it's the last @font-face block in the file.
    const matches = [...css.matchAll(/src: url\(([^)]+)\) format\('woff'\)/g)];
    if (!matches.length) throw new Error(`No woff url found for ${family}`);
    const fontUrl = matches[matches.length - 1][1];

    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) throw new Error(`Font file fetch failed for ${family}: ${fontRes.status}`);
    return fontRes.arrayBuffer();
  })();

  cache.set(key, promise);
  return promise;
}

export interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight;
  style: "normal" | "italic";
}

export async function loadSocialPostFonts(): Promise<LoadedFont[]> {
  const [playfairBold, playfairRegular, playfairItalic, caveatBold, interBold, interRegular] = await Promise.all([
    fetchWoffBytes("Playfair Display", 700, false),
    fetchWoffBytes("Playfair Display", 400, false),
    fetchWoffBytes("Playfair Display", 400, true),
    fetchWoffBytes("Caveat", 700, false),
    fetchWoffBytes("Inter", 700, false),
    fetchWoffBytes("Inter", 400, false),
  ]);

  return [
    { name: "Playfair Display", data: playfairBold, weight: 700, style: "normal" },
    { name: "Playfair Display", data: playfairRegular, weight: 400, style: "normal" },
    { name: "Playfair Display", data: playfairItalic, weight: 400, style: "italic" },
    { name: "Caveat", data: caveatBold, weight: 700, style: "normal" },
    { name: "Inter", data: interBold, weight: 700, style: "normal" },
    { name: "Inter", data: interRegular, weight: 400, style: "normal" },
  ];
}
