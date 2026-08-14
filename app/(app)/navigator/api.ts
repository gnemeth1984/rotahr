// Tiny fetch wrapper — every Navigator route returns JSON and { error } on failure.
export async function api<T = any>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(`/api/navigator${path}`, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as any)?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}
