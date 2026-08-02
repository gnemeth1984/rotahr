import QRCode from "qrcode";

// Brand palette — navy on white. High contrast is what scanners actually need.
export const QR_DARK = "#0F1C35";
export const QR_LIGHT = "#ffffff";

const CANONICAL = "https://rotahr.com";

/**
 * Public base URL for links that leave the server and land in a customer's
 * inbox. Deliberately stricter than reading NEXTAUTH_URL directly: a QR or
 * redeem link pointing at localhost or a preview deployment is dead on arrival
 * for the recipient, and unlike an in-app link nobody here can fix it after
 * the email has been sent. So we fall back to the canonical domain rather than
 * trusting whatever the env happens to hold.
 */
function baseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "").trim();
  if (!raw) return CANONICAL;

  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    return CANONICAL;
  }

  // Local/preview hosts can't be reached by a recipient's mail client.
  const unreachable =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    host.endsWith(".vercel.app");

  return unreachable ? CANONICAL : raw.replace(/\/+$/, "");
}

/**
 * QR as a base64 data URI. Fine for showing in the app UI (a browser renders
 * these happily) but NEVER use it in an outbound email — Gmail and
 * Outlook.com strip `data:` URI images entirely, and no recipient-side
 * "always show images" setting overrides that. Use getOfferQrImageUrl() for
 * anything that lands in an inbox.
 */
export async function generateOfferQrDataUri(code: string): Promise<string> {
  return QRCode.toDataURL(getRedeemUrl(code), {
    width: 220,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: QR_DARK, light: QR_LIGHT },
  });
}

/**
 * Hosted QR image URL — use this in emails. Absolute by necessity: an email
 * client has no origin to resolve a relative path against.
 */
export function getOfferQrImageUrl(code: string): string {
  return `${baseUrl()}/api/crm/offers/qr/${encodeURIComponent(code)}`;
}

export function getRedeemUrl(code: string): string {
  return `${baseUrl()}/redeem/${encodeURIComponent(code)}`;
}
