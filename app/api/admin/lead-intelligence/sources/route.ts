import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminGuard, apiError, mutationGuard } from "@/lib/lead-intelligence/auth";
import { configuration } from "@/lib/lead-intelligence/providers";
import { saveSeed } from "@/lib/lead-intelligence/service";
import { runSourceImports } from "@/lib/lead-intelligence/sources";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=300;
/** Manual run of the free FSAI/FHRS imports. forceFsai ignores the weekly FSAI gate. */
export async function POST(req:NextRequest) {
  const denied=await adminGuard() || mutationGuard(req); if(denied) return denied;
  const body=z.object({forceFsai:z.boolean().optional()}).safeParse(await req.json().catch(()=>({})));
  if(!body.success) return NextResponse.json({error:"Invalid request."},{status:400});
  if(!configuration().enabled) return NextResponse.json({error:"Lead Intelligence is disabled."},{status:503});
  try {return NextResponse.json(await runSourceImports(saveSeed,{forceFsai:body.data.forceFsai}));}
  catch(e) {return apiError(e);}
}
