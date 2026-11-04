import { NextRequest, NextResponse } from "next/server";
import { validCronAuth } from "@/lib/lead-intelligence/cron-auth";
import { apiError } from "@/lib/lead-intelligence/errors";
import { configuration } from "@/lib/lead-intelligence/providers";
import { saveSeed } from "@/lib/lead-intelligence/service";
import { runSourceImports } from "@/lib/lead-intelligence/sources";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=300;
/** Free trigger sources only (FSAI weekly, FHRS daily). No paid provider is called, so no Serper/OpenAI key is needed. */
export async function GET(req:NextRequest) {
  if(!validCronAuth(req.headers.get("authorization"),process.env.CRON_SECRET)) return NextResponse.json({error:"Unauthorized"},{status:401});
  if(!configuration().enabled) return NextResponse.json({skipped:true,reason:"Lead Intelligence disabled"});
  try {return NextResponse.json(await runSourceImports(saveSeed));}
  catch(e) {return apiError(e);}
}
