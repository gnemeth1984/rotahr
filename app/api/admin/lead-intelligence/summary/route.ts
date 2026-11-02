import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminGuard, apiError } from "@/lib/lead-intelligence/auth";
import { configuration } from "@/lib/lead-intelligence/providers";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET() {
  const denied=await adminGuard(); if(denied) return denied;
  try {
    const today=new Date(); today.setUTCHours(0,0,0,0);
    const active={status:{notIn:["suppressed","not_interested","converted"]}};
    const [newLeads,analysed,drafts,phoneFirst,hot,recent,ready,draftsReady,top10,runs]=await Promise.all([
      prisma.leadIntelligenceLead.count({where:{createdAt:{gte:today}}}),
      prisma.leadIntelligenceLead.count({where:{analysedAt:{gte:today}}}),
      prisma.leadIntelligenceAnalysis.count({where:{createdAt:{gte:today},emailBody:{not:null}}}),
      prisma.leadIntelligenceLead.count({where:{...active,bestContactMethod:"phone",contactedAt:null}}),
      prisma.leadIntelligenceLead.count({where:{...active,intentStatus:"Hot",fitScore:{gte:70}}}),
      prisma.leadIntelligenceLead.count({where:{...active,analysedAt:{gte:new Date(Date.now()-7*86400000)}}}),
      prisma.leadIntelligenceLead.count({where:{...active,bestContactMethod:{not:null},fitScore:{not:null},contactedAt:null}}),
      prisma.leadIntelligenceLead.count({where:{...active,contactedAt:null,analyses:{some:{emailBody:{not:null}}}}}),
      prisma.leadIntelligenceLead.findMany({where:{...active,fitScore:{not:null},contactedAt:null},orderBy:[{priorityScore:"desc"},{id:"asc"}],take:10,
        select:{id:true,name:true,city:true,country:true,classification:true,fitScore:true,priorityScore:true,bestContactMethod:true}}),
      prisma.leadIntelligenceRun.findMany({orderBy:{startedAt:"desc"},take:5}),
    ]);
    return NextResponse.json({date:today.toISOString().slice(0,10),timezone:"UTC",newLeads,analysed,emailDrafts:drafts*2,phoneFirst,hot,recent,ready,draftsReady,top10,runs,config:configuration()});
  } catch(e) {return apiError(e);}
}