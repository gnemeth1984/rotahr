import { requireAdmin, proxyGet } from "../_proxy";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const params = new URLSearchParams();
  const limit = req.nextUrl.searchParams.get("limit");
  if (limit) params.set("limit", limit);
  return proxyGet("/api/sends", params);
}
