import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getRedeemUrl, QR_DARK, QR_LIGHT } from "@/lib/crm/qr";

/**
 * Public QR image for a promo offer.
 *
 * This endpoint is intentionally unauthenticated: it is loaded by the
 * recipient's email client (Gmail, Outlook, Apple Mail), which has no session
 * and no cookies. Inline `data:` URI images are stripped outright by Gmail and
 * Outlook.com, so the QR has to be served from a real URL to render at all.
 *
 * Nothing sensitive is exposed — the response is only a QR encoding the redeem
 * URL, which already contains the code that the recipient was emailed. Offer
 * details and the redeem action itself both stay behind staff auth. We only
 * render codes that exist so this can't be used as a generic QR generator.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);

  const offer = await prisma.promoOffer.findUnique({
    where: { code },
    select: { code: true },
  });
  if (!offer) return new NextResponse("Not found", { status: 404 });

  const png = await QRCode.toBuffer(getRedeemUrl(offer.code), {
    type: "png",
    width: 600, // generous — email clients downscale, and print/retina stays crisp
    margin: 2, // quiet zone; scanners need it
    errorCorrectionLevel: "H", // survives glare, thumbprints, a creased screen
    color: { dark: QR_DARK, light: QR_LIGHT },
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // Offer codes are immutable, so this can be cached hard. Matters because
      // Gmail proxies and re-fetches images through its own image cache.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
