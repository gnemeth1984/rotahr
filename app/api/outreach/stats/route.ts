import { requireAdmin, proxyGet } from "../_proxy";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return proxyGet("/api/stats");
}
