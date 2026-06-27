/**
 * Lightspeed K-Series (Kounta) POS integration
 * Docs: https://developers.lightspeedhq.com/k-series/
 */

const BASE_URL = "https://api.kounta.com/v1";
const AUTH_URL = "https://auth.kounta.com";

export function getLightspeedAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.LIGHTSPEED_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/pos/callback/lightspeed`,
    response_type: "code",
    scope: "read",
    state,
  });
  return `${AUTH_URL}/authorize?${params}`;
}

export async function exchangeLightspeedCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(`${AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.LIGHTSPEED_CLIENT_ID!,
      client_secret: process.env.LIGHTSPEED_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/pos/callback/lightspeed`,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Lightspeed token exchange failed: ${err}`);
  }
  return res.json();
}

export async function refreshLightspeedToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(`${AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.LIGHTSPEED_CLIENT_ID!,
      client_secret: process.env.LIGHTSPEED_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error("Lightspeed token refresh failed");
  return res.json();
}

async function lsGet(path: string, accessToken: string) {
  const res = await fetch(`${BASE_URL}${path}.json`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Lightspeed API error ${res.status}: ${path}`);
  return res.json();
}

export async function getLightspeedCompanyId(accessToken: string): Promise<string> {
  const data = await lsGet("/companies/current", accessToken);
  return String(data.id);
}

export interface PosSnapshot {
  totalRevenue: number;
  totalCovers: number;
  totalTransactions: number;
  hourlyData: { hour: number; revenue: number; transactions: number }[];
  topItems: { name: string; count: number; revenue: number }[];
}

export async function fetchLightspeedDayData(
  accessToken: string,
  companyId: string,
  date: Date
): Promise<PosSnapshot> {
  const dateStr = date.toISOString().split("T")[0];
  const startIso = `${dateStr}T00:00:00Z`;
  const endIso = `${dateStr}T23:59:59Z`;

  // Fetch orders for the day
  const ordersData = await lsGet(
    `/companies/${companyId}/orders?created_at_min=${startIso}&created_at_max=${endIso}&status=complete&per_page=250`,
    accessToken
  );

  const orders = ordersData || [];

  let totalRevenue = 0;
  let totalCovers = 0;
  const hourlyMap: Record<number, { revenue: number; transactions: number }> = {};
  const itemMap: Record<string, { count: number; revenue: number }> = {};

  for (const order of orders) {
    const revenue = parseFloat(order.total ?? 0);
    totalRevenue += revenue;
    totalCovers += order.cover_count ?? 0;

    const hour = new Date(order.created_at).getUTCHours();
    if (!hourlyMap[hour]) hourlyMap[hour] = { revenue: 0, transactions: 0 };
    hourlyMap[hour].revenue += revenue;
    hourlyMap[hour].transactions += 1;

    // Line items
    for (const line of order.line_items ?? []) {
      const name = line.name ?? "Unknown";
      const qty = line.quantity ?? 1;
      const lineRevenue = parseFloat(line.total ?? 0);
      if (!itemMap[name]) itemMap[name] = { count: 0, revenue: 0 };
      itemMap[name].count += qty;
      itemMap[name].revenue += lineRevenue;
    }
  }

  const hourlyData = Object.entries(hourlyMap)
    .map(([h, v]) => ({ hour: parseInt(h), ...v }))
    .sort((a, b) => a.hour - b.hour);

  const topItems = Object.entries(itemMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalRevenue,
    totalCovers,
    totalTransactions: orders.length,
    hourlyData,
    topItems,
  };
}
