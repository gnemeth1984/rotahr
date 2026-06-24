import { requireAdmin, proxyPost } from "../_proxy";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  return proxyPost("/api/batch", body);
}
