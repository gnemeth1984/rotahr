import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminGuard, apiError, mutationGuard } from "@/lib/lead-intelligence/auth";
import { configuration } from "@/lib/lead-intelligence/providers";
import { runIntelligence } from "@/lib/lead-intelligence/service";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=300;
export async function POST(req:NextRequest) {
  const denied=await adminGuard() || mutationGuard(req); if(denied) return denied;
  const body=z.object({leadId:z.string().min(1).max(100).optional()}).safeParse(await req.json().catch(()=>null));
  if(!body.success) return NextResponse.json({error:"Invalid run request."},{status:400});
  const c=configuration();
  if(!c.enabled || !c.searchConfigured || !c.aiConfigured) return NextResponse.json({error:"Not enabled/configured. Apply migration and configure real search/AI keys before running.",config:c},{status:503});
  try {return NextResponse.json(await runIntelligence("manual",body.data.leadId));}
  catch(e) {return apiError(e);}
}