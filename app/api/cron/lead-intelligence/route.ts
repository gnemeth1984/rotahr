import { NextRequest, NextResponse } from "next/server";
import { validCronAuth } from "@/lib/lead-intelligence/cron-auth";
import { apiError } from "@/lib/lead-intelligence/errors";
import { configuration } from "@/lib/lead-intelligence/providers";
import { runIntelligence } from "@/lib/lead-intelligence/service";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=300;
export async function GET(req:NextRequest) {
  if(!validCronAuth(req.headers.get("authorization"),process.env.CRON_SECRET)) return NextResponse.json({error:"Unauthorized"},{status:401});
  const c=configuration();
  if(!c.enabled) return NextResponse.json({skipped:true,reason:"Lead Intelligence disabled"});
  if(!c.searchConfigured || !c.aiConfigured) return NextResponse.json({error:"Search/AI configuration missing; no run started."},{status:503});
  try {return NextResponse.json(await runIntelligence("cron"));}
  catch(e) {return apiError(e);}
}