import { requireAdmin, proxyGet } from "../_proxy";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const params = new URLSearchParams();
  ["page", "limit", "status", "country", "search"].forEach(k => {
    const v = req.nextUrl.searchParams.get(k);
    if (v) params.set(k, v);
  });
  return proxyGet("/api/leads", params);
}
