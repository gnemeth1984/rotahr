/**
 * Square POS integration
 * Docs: https://developer.squareup.com/docs
 */

const SQUARE_BASE =
  process.env.NODE_ENV === "production"
    ? "https://connect.squareapis.com"
    : "https://connect.squareupsandbox.com";

const SQUARE_AUTH = "https://connect.squareup.com";

export function getSquareAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SQUARE_APP_ID!,
    response_type: "code",
    scope: "PAYMENTS_READ ORDERS_READ ITEMS_READ MERCHANT_PROFILE_READ",
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/pos/callback/square`,
    state,
    session: "false",
  });
  return `${SQUARE_AUTH}/oauth2/authorize?${params}`;
}

export async function exchangeSquareCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: string;
  merchant_id: string;
}> {
  const res = await fetch(`${SQUARE_AUTH}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": "2024-01-17",
    },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APP_ID,
      client_secret: process.env.SQUARE_APP_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/pos/callback/square`,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Square token exchange failed: ${err}`);
  }
  return res.json();
}

export async function refreshSquareToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: string;
}> {
  const res = await fetch(`${SQUARE_AUTH}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": "2024-01-17",
    },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APP_ID,
      client_secret: process.env.SQUARE_APP_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Square token refresh failed");
  return res.json();
}

async function sqGet(path: string, accessToken: string) {
  const res = await fetch(`${SQUARE_BASE}/v2${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": "2024-01-17",
    },
  });
  if (!res.ok) throw new Error(`Square API error ${res.status}: ${path}`);
  return res.json();
}

async function sqPost(path: string, accessToken: string, body: object) {
  const res = await fetch(`${SQUARE_BASE}/v2${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": "2024-01-17",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Square API error ${res.status}: ${path}`);
  return res.json();
}

export async function getSquareLocations(accessToken: string): Promise<{ id: string; name: string }[]> {
  const data = await sqGet("/locations", accessToken);
  return (data.locations ?? []).map((l: { id: string; name: string }) => ({ id: l.id, name: l.name }));
}

export interface PosSnapshot {
  totalRevenue: number;
  totalCovers: number;
  totalTransactions: number;
  hourlyData: { hour: number; revenue: number; transactions: number }[];
  topItems: { name: string; count: number; revenue: number }[];
}

export async function fetchSquareDayData(
  accessToken: string,
  locationId: string,
  date: Date
): Promise<PosSnapshot> {
  const dateStr = date.toISOString().split("T")[0];
  const startRfc = `${dateStr}T00:00:00Z`;
  const endRfc = `${dateStr}T23:59:59Z`;

  // Search orders
  let orders: Record<string, unknown>[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      location_ids: [locationId],
      query: {
        filter: {
          date_time_filter: {
            created_at: { start_at: startRfc, end_at: endRfc },
          },
          state_filter: { states: ["COMPLETED"] },
        },
      },
      limit: 500,
    };
    if (cursor) body.cursor = cursor;

    const data = await sqPost("/orders/search", accessToken, body);
    orders = orders.concat(data.orders ?? []);
    cursor = data.cursor;
  } while (cursor);

  let totalRevenue = 0;
  let totalCovers = 0;
  const hourlyMap: Record<number, { revenue: number; transactions: number }> = {};
  const itemMap: Record<string, { count: number; revenue: number }> = {};

  for (const order of orders) {
    const totalMoney = (order.total_money as { amount?: number }) ?? {};
    const revenueCents = totalMoney.amount ?? 0;
    const revenue = revenueCents / 100;
    totalRevenue += revenue;

    // Square doesn't have covers natively — use line item count as proxy
    const lineItems = (order.line_items as Record<string, unknown>[]) ?? [];
    totalCovers += 1; // each order = 1 cover proxy

    const createdAt = order.created_at as string;
    const hour = createdAt ? new Date(createdAt).getUTCHours() : 0;
    if (!hourlyMap[hour]) hourlyMap[hour] = { revenue: 0, transactions: 0 };
    hourlyMap[hour].revenue += revenue;
    hourlyMap[hour].transactions += 1;

    for (const item of lineItems) {
      const name = (item.name as string) ?? "Unknown";
      const qty = parseInt(String(item.quantity ?? 1));
      const basePrice = ((item.base_price_money as { amount?: number }) ?? {}).amount ?? 0;
      const lineRevenue = (basePrice * qty) / 100;
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
    totalCovers: orders.length,
    totalTransactions: orders.length,
    hourlyData,
    topItems,
  };
}
