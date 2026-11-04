import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminGuard, apiError, mutationGuard } from "@/lib/lead-intelligence/auth";
import { configuration } from "@/lib/lead-intelligence/providers";
import { saveSeed } from "@/lib/lead-intelligence/service";
import { LEAD_STATUSES, canonicalUrl } from "@/lib/lead-intelligence/types";
import { PURSUED_GRADES } from "@/lib/lead-intelligence/signals";
import { allowedUrl } from "@/lib/lead-intelligence/crawl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const createSchema = z.object({name:z.string().min(2).max(150),website:z.string().max(2000).nullable().optional(),country:z.enum(["ie","uk"]),county:z.string().max(100).default(""),city:z.string().min(2).max(100),address:z.string().max(300).default(""),category:z.string().max(80).default("hospitality"),sourceUrl:z.string().max(2000).optional()});

export async function GET(req: NextRequest) {
  const denied = await adminGuard(); if (denied) return denied;
  try {
    const p = req.nextUrl.searchParams;
    const id = p.get("id");
    if (id) {
      const lead = await prisma.leadIntelligenceLead.findUnique({where:{id},include:{analyses:{orderBy:{createdAt:"desc"},take:5},triggerSignals:{orderBy:[{points:"desc"},{observedAt:"desc"}],take:50}}});
      return lead ? NextResponse.json({lead}) : NextResponse.json({error:"Lead not found"},{status:404});
    }
    const where:Prisma.LeadIntelligenceLeadWhereInput = {};
    if (["ie","uk"].includes(p.get("country")??"")) where.country=p.get("country")!;
    if (p.get("county")) where.county={equals:p.get("county")!.slice(0,100),mode:"insensitive"};
    if (["A+","A","B","C","UNQUALIFIED"].includes(p.get("classification")??"")) where.classification=p.get("classification")!;
    if (["A+","A","B","C","D"].includes(p.get("grade")??"")) where.grade=p.get("grade")!;
    if (p.get("grade")==="pursued") where.grade={in:[...PURSUED_GRADES]};
    const minScore=p.get("leadScore"); if (minScore && Number.isFinite(Number(minScore))) where.leadScore={gte:Math.max(0,Math.floor(Number(minScore)))};
    if (["hiring","fhrs","fsai","multi_site"].includes(p.get("signal")??"")) {
      const sig=p.get("signal")!;
      where.triggerSignals={some:sig==="hiring"?{type:{startsWith:"hiring_"}}:sig==="fhrs"?{type:"fhrs_rating"}:sig==="fsai"?{type:{startsWith:"fsai_"}}:{type:"multi_site"}};
    }
    const q = p.get("q")?.slice(0,150);
    if (q) where.OR=[{name:{contains:q,mode:"insensitive"}},{city:{contains:q,mode:"insensitive"}}];
    for (const [param,field] of [["fit","fitScore"],["intent","intentScore"],["priority","priorityScore"]] as const) {
      const raw=p.get(param); if(raw && Number.isFinite(Number(raw))) where[field]={gte:Math.min(100,Math.max(0,Number(raw)))};
    }
    const intentStatus=p.get("intentStatus");
    if (["unknown","Cold","Warm","Interested","Hot"].includes(intentStatus??"")) where.intentStatus=intentStatus!;
    if (p.get("contacted")==="yes") where.contactedAt={not:null};
    if (p.get("contacted")==="no") where.contactedAt=null;
    if (p.get("view")==="hot") {where.intentStatus="Hot";where.fitScore={gte:70};}
    if (p.get("view")==="ready") {where.bestContactMethod={not:null};where.status={notIn:["suppressed","converted","not_interested"]};where.contactedAt=null;}
    if (p.get("view")==="drafts") {where.analyses={some:{emailBody:{not:null}}};where.contactedAt=null;}
    if (p.get("view")==="recent") where.analysedAt={gte:new Date(Date.now()-7*86400000)};
    // "Top 50 to buy this month": pursued grades (A+/A/B) that are still open, highest trigger score first.
    const buy = p.get("view")==="buy";
    if (buy) {where.grade={in:[...PURSUED_GRADES]};where.status={notIn:["suppressed","converted","not_interested"]};}
    const size = buy ? 50 : 25;
    const page=buy ? 1 : Math.max(1,Math.min(10000,Math.floor(Number(p.get("page"))||1)));
    const [leads,total,counties] = await Promise.all([
      prisma.leadIntelligenceLead.findMany({where,orderBy:[{leadScore:"desc"},{priorityScore:"desc"},{fitScore:{sort:"desc",nulls:"last"}},{id:"asc"}],take:size,skip:(page-1)*size}),
      buy ? prisma.leadIntelligenceLead.count({where}).then(n=>Math.min(n,50)) : prisma.leadIntelligenceLead.count({where}),
      prisma.leadIntelligenceLead.findMany({select:{county:true},distinct:["county"],where:{county:{not:""}},take:200,orderBy:{county:"asc"}}),
    ]);
    return NextResponse.json({leads,total,page,pages:Math.ceil(total/size),counties:counties.map(c=>c.county),config:configuration()});
  } catch(e) { return apiError(e); }
}

export async function POST(req: NextRequest) {
  const denied = await adminGuard() || mutationGuard(req); if(denied) return denied;
  const parsed=createSchema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:"Name, city and Ireland/UK country are required."},{status:400});
  const p=parsed.data; const website=p.website?canonicalUrl(p.website):null;
  const sourceUrl=p.sourceUrl?canonicalUrl(p.sourceUrl):website;
  if(!sourceUrl || p.website && !website) return NextResponse.json({error:"Provide a public website or source URL."},{status:400});
  try { allowedUrl(sourceUrl); if(website) allowedUrl(website); }
  catch { return NextResponse.json({error:"Private, credential-bearing or unsupported URLs are not allowed."},{status:400}); }
  try { return NextResponse.json(await saveSeed({...p,website,sourceUrl,sourceKind:"manual"}),{status:201}); }
  catch(e) {return apiError(e);}
}

export async function PATCH(req: NextRequest) {
  const denied=await adminGuard() || mutationGuard(req); if(denied) return denied;
  const body=z.object({id:z.string().min(1).max(100),status:z.enum(LEAD_STATUSES).optional(),notes:z.string().max(5000).optional()}).safeParse(await req.json().catch(()=>null));
  if(!body.success) return NextResponse.json({error:"Invalid lead update."},{status:400});
  const {id,...data}=body.data;
  try {
    const lead=await prisma.leadIntelligenceLead.update({where:{id},data:{...data,...(data.status==="contacted"?{contactedAt:new Date()}:{}),...(data.status==="new"?{nextAnalysisAt:new Date()}: {})}});
    return NextResponse.json({lead});
  } catch(e) {return apiError(e);}
}