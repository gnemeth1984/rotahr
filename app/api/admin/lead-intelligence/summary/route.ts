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
    const [newLeads,analysed,drafts,phoneFirst,hot,recent,ready,draftsReady,top10,runs,gradeRows,triggerLeads,sources]=await Promise.all([
      prisma.leadIntelligenceLead.count({where:{createdAt:{gte:today}}}),
      prisma.leadIntelligenceLead.count({where:{analysedAt:{gte:today}}}),
      prisma.leadIntelligenceAnalysis.count({where:{createdAt:{gte:today},emailBody:{not:null}}}),
      prisma.leadIntelligenceLead.count({where:{...active,bestContactMethod:"phone",contactedAt:null}}),
      prisma.leadIntelligenceLead.count({where:{...active,intentStatus:"Hot",fitScore:{gte:70}}}),
      prisma.leadIntelligenceLead.count({where:{...active,analysedAt:{gte:new Date(Date.now()-7*86400000)}}}),
      prisma.leadIntelligenceLead.count({where:{...active,bestContactMethod:{not:null},fitScore:{not:null},contactedAt:null}}),
      prisma.leadIntelligenceLead.count({where:{...active,contactedAt:null,analyses:{some:{emailBody:{not:null}}}}}),
      prisma.leadIntelligenceLead.findMany({where:{...active,contactedAt:null,OR:[{leadScore:{gt:0}},{fitScore:{not:null}}]},
        orderBy:[{leadScore:"desc"},{priorityScore:"desc"},{id:"asc"}],take:10,
        select:{id:true,name:true,city:true,country:true,classification:true,fitScore:true,priorityScore:true,bestContactMethod:true,leadScore:true,grade:true,signalSummary:true}}),
      prisma.leadIntelligenceRun.findMany({orderBy:{startedAt:"desc"},take:5}),
      prisma.leadIntelligenceLead.groupBy({by:["grade"],where:active,_count:{_all:true}}),
      prisma.leadIntelligenceLead.count({where:{...active,leadScore:{gt:0}}}),
      prisma.leadIntelligenceSourceSync.findMany({where:{source:{in:["fhrs","fsai"]}},select:{source:true,lastRunAt:true,lastStatus:true,details:true}}),
    ]);
    const grades=Object.fromEntries(["A+","A","B","C","D"].map(g=>[g,gradeRows.find(r=>r.grade===g)?._count._all??0]));
    return NextResponse.json({date:today.toISOString().slice(0,10),timezone:"UTC",newLeads,analysed,emailDrafts:drafts*2,phoneFirst,hot,recent,ready,draftsReady,top10,runs,grades,triggerLeads,sources,config:configuration()});
  } catch(e) {return apiError(e);}
}