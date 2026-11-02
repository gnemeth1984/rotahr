import { NextResponse } from "next/server";

/** Session-free so the cron route does not load next-auth. */
export function apiError(e: unknown) {
  const code = e && typeof e==="object" && "code" in e ? String(e.code) : "";
  // Server-side log only: error class/code plus a truncated message. Never request bodies, headers or env values.
  console.error("[lead-intelligence]", code || (e instanceof Error ? e.name : "unknown"), e instanceof Error ? e.message.slice(0,300) : "");
  if (["P2021","P2022"].includes(code)) return NextResponse.json({error:"Lead Intelligence migration has not been applied."},{status:503});
  // No raw provider, database, network or credential-bearing errors in responses.
  return NextResponse.json({error:"Lead Intelligence request failed. Check server logs and run history."},{status:500});
}