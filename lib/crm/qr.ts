import QRCode from "qrcode";

/**
 * Generates a QR code as a base64 data URI, encoding a link to the in-app
 * redemption page for a given offer code. Embedding it inline (not hotlinked)
 * keeps it deliverability-safe — no external image request for spam filters
 * to flag, and it still renders even if the recipient is offline later.
 */
export async function generateOfferQrDataUri(code: string): Promise<string> {
  const baseUrl = process.env.NEXTAUTH_URL || "https://rotahr.com";
  const redeemUrl = `${baseUrl}/redeem/${encodeURIComponent(code)}`;
  return QRCode.toDataURL(redeemUrl, {
    width: 220,
    margin: 1,
    color: { dark: "#1e1b4b", light: "#ffffff" },
  });
}

export function getRedeemUrl(code: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || "https://rotahr.com";
  return `${baseUrl}/redeem/${encodeURIComponent(code)}`;
}
