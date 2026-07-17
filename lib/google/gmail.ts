// @ts-nocheck
// Minimal Gmail OAuth + send helper — plain fetch, no googleapis SDK needed.
import { prisma } from "@/lib/db";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function getRedirectUri() {
  const base = process.env.NEXTAUTH_URL || "https://rotahr.com";
  return `${base}/api/integrations/gmail/callback`;
}

export function getGmailAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent", // always show consent so we reliably get a refresh_token
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
  }>;
}

export async function getGoogleUserEmail(accessToken: string) {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google user info");
  const data = await res.json();
  return data.email as string;
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

/** Returns a valid access token for the business's connected Gmail account, refreshing if needed. */
export async function getValidAccessToken(businessId: string): Promise<{ accessToken: string; email: string } | null> {
  const conn = await prisma.emailConnection.findUnique({ where: { businessId } });
  if (!conn) return null;

  const expiresSoon = conn.expiresAt.getTime() - Date.now() < 60_000; // refresh if <1min left
  if (!expiresSoon) return { accessToken: conn.accessToken, email: conn.email };

  const refreshed = await refreshAccessToken(conn.refreshToken);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await prisma.emailConnection.update({
    where: { businessId },
    data: { accessToken: refreshed.access_token, expiresAt },
  });
  return { accessToken: refreshed.access_token, email: conn.email };
}

function encodeMimeSubject(subject: string) {
  // Support non-ASCII subjects (e.g. accented names) per RFC 2047
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

function toBase64Url(input: string) {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function htmlToPlainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Sends an email via the business's connected Gmail account. Throws if not connected. */
export async function sendViaGmail(params: {
  businessId: string;
  to: string;
  subject: string;
  html: string;
}) {
  const token = await getValidAccessToken(params.businessId);
  if (!token) throw new Error("No Gmail connection for this business");

  const business = await prisma.business.findUnique({
    where: { id: params.businessId },
    select: { name: true },
  });
  const displayName = business?.name ? `"${business.name.replace(/"/g, "'")}"` : null;
  const fromHeader = displayName ? `${displayName} <${token.email}>` : token.email;

  const boundary = `----=_RotahrBoundary_${crypto.randomUUID()}`;
  const plainText = htmlToPlainText(params.html);

  const mime = [
    `From: ${fromHeader}`,
    `To: ${params.to}`,
    `Subject: ${encodeMimeSubject(params.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    plainText,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    params.html,
    "",
    `--${boundary}--`,
  ].join("\r\n");

  const res = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: toBase64Url(mime) }),
  });

  if (!res.ok) {
    throw new Error(`Gmail send failed: ${await res.text()}`);
  }

  return { sentFrom: fromHeader };
}
