import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TOPICS = [
  { title: "How to Build a Staff Rota for Your Irish Restaurant", category: "scheduling", tags: "rota,scheduling,ireland,restaurant" },
  { title: "Irish Employment Law: What Every Restaurant Owner Must Know in 2025", category: "compliance", tags: "employment law,ireland,restaurant,compliance" },
  { title: "How to Reduce Staff Turnover in Irish Hospitality", category: "hr", tags: "staff retention,hospitality,ireland,hr" },
  { title: "HACCP Compliance Checklist for Irish Restaurants and Bars", category: "compliance", tags: "HACCP,food safety,ireland,compliance" },
  { title: "Managing Seasonal Staff in Irish Hotels and Restaurants", category: "scheduling", tags: "seasonal staff,ireland,hotel,restaurant" },
  { title: "How Much Does Agency Staff Cost Irish Restaurants vs Permanent Hire", category: "costs", tags: "agency staff,costs,ireland,restaurant" },
  { title: "Irish Minimum Wage 2025: What Hospitality Employers Need to Know", category: "compliance", tags: "minimum wage,ireland,hospitality,employment" },
  { title: "Tips and Tronc Systems for Irish Restaurants: A Complete Guide", category: "payroll", tags: "tips,tronc,payroll,ireland,restaurant" },
  { title: "How to Handle Last-Minute Staff Callouts in a Busy Restaurant", category: "scheduling", tags: "callouts,scheduling,restaurant,ireland" },
  { title: "Staff Scheduling Software vs Spreadsheets: What Irish Restaurants Save", category: "scheduling", tags: "scheduling software,spreadsheets,ireland,restaurant" },
  { title: "How to Write a Staff Rota That Keeps Everyone Happy", category: "scheduling", tags: "rota,staff,scheduling,tips" },
  { title: "Restaurant Manager Burnout in Ireland: Signs and Solutions", category: "hr", tags: "burnout,manager,ireland,hospitality" },
  { title: "Irish Public Holidays 2025: How to Schedule Staff Correctly", category: "compliance", tags: "public holidays,ireland,scheduling,employment" },
  { title: "How to Run a Profitable Irish Bar: Cost Control Guide", category: "finance", tags: "bar,profit,costs,ireland" },
  { title: "Zero-Hour Contracts in Ireland: Rules for Hospitality Employers", category: "compliance", tags: "zero hour contracts,ireland,employment law" },
  { title: "How to Onboard New Kitchen Staff Quickly and Effectively", category: "hr", tags: "onboarding,kitchen staff,ireland,training" },
  { title: "The True Cost of a No-Show Shift in Irish Hospitality", category: "costs", tags: "no show,costs,ireland,hospitality" },
  { title: "How to Schedule Staff for Christmas in Irish Restaurants", category: "scheduling", tags: "christmas,scheduling,ireland,restaurant" },
  { title: "Irish Restaurant Technology: Tools Every Modern Venue Should Use", category: "technology", tags: "technology,restaurant,ireland,software" },
  { title: "How to Calculate Labour Cost as a Percentage of Revenue", category: "finance", tags: "labour cost,revenue,restaurant,finance" },
  { title: "Time Off Requests in Irish Hospitality: Best Practices", category: "hr", tags: "time off,holidays,ireland,hospitality" },
  { title: "How to Manage a Multi-Venue Hospitality Business in Ireland", category: "management", tags: "multi venue,management,ireland,hospitality" },
  { title: "Restaurant Staff Communication: WhatsApp vs Proper Systems", category: "management", tags: "communication,whatsapp,restaurant,ireland" },
  { title: "How to Keep Kitchen Staff Motivated During Busy Summer Season", category: "hr", tags: "motivation,kitchen staff,summer,ireland" },
  { title: "Irish Bar Licensing Hours and Staff Compliance Guide", category: "compliance", tags: "licensing,bar,ireland,compliance" },
  { title: "How to Cut Overtime Costs Without Losing Staff in Irish Restaurants", category: "costs", tags: "overtime,costs,ireland,restaurant" },
  { title: "Part-Time Staff Rights in Ireland: A Guide for Hospitality Employers", category: "compliance", tags: "part time,rights,ireland,employment" },
  { title: "How to Handle Staff Disputes in Irish Restaurants", category: "hr", tags: "disputes,hr,ireland,restaurant" },
  { title: "Building a Back-of-House Team for a New Irish Restaurant", category: "hr", tags: "kitchen,team,new restaurant,ireland" },
  { title: "Front of House Training Tips for Irish Restaurant Managers", category: "hr", tags: "front of house,training,ireland,restaurant" },
  { title: "How to Use Data to Improve Your Restaurant Rota", category: "scheduling", tags: "data,rota,scheduling,restaurant" },
  { title: "Irish Restaurant Payroll: Weekly vs Monthly Pay Explained", category: "payroll", tags: "payroll,weekly,monthly,ireland,restaurant" },
  { title: "How to Retain Your Best Chefs in a Competitive Irish Market", category: "hr", tags: "chefs,retention,ireland,kitchen" },
  { title: "Restaurant Rota Apps vs Paper: The Real Difference for Irish Venues", category: "scheduling", tags: "rota app,paper,ireland,venue" },
  { title: "How to Prepare Your Irish Restaurant for a Revenue Commissioners Audit", category: "compliance", tags: "revenue,audit,ireland,restaurant" },
  { title: "Clocking In Systems for Irish Restaurants: What You Need to Know", category: "technology", tags: "clock in,ireland,restaurant,technology" },
  { title: "How to Build a Hospitality Business in Ireland From Scratch", category: "management", tags: "hospitality,ireland,startup,business" },
  { title: "Night Shift Pay Rules in Irish Hospitality", category: "compliance", tags: "night shift,pay,ireland,hospitality" },
  { title: "Summer Staff Planning for Irish Coastal Restaurants", category: "scheduling", tags: "summer,coastal,ireland,restaurant,scheduling" },
  { title: "How to Handle Sick Leave in Irish Restaurants Under the New Rules", category: "compliance", tags: "sick leave,ireland,restaurant,statutory" },
  { title: "Rota Planning for Bank Holidays in Irish Pubs and Bars", category: "scheduling", tags: "bank holiday,pub,bar,ireland,rota" },
  { title: "How to Train a New Bar Manager in an Irish Pub", category: "hr", tags: "bar manager,training,ireland,pub" },
  { title: "How Rotahr Helps Irish Restaurant Owners Save Time Every Week", category: "product", tags: "rotahr,scheduling,ireland,restaurant,time saving" },
  { title: "What is a Rota and How Should Irish Businesses Use One", category: "scheduling", tags: "rota,ireland,scheduling,beginner" },
  { title: "Staff Availability Management for Irish Hospitality Venues", category: "scheduling", tags: "availability,staff,ireland,hospitality" },
];

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret');
  const authed =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    secret === process.env.CRON_SECRET;
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const existingSlugs = await prisma.blogPost.findMany({ select: { slug: true } });
    const usedSlugs = new Set(existingSlugs.map((p: { slug: string }) => p.slug));
    const available = TOPICS.filter(t => !usedSlugs.has(slugify(t.title)));

    if (available.length === 0) {
      return NextResponse.json({ message: 'All topics published, great job!' });
    }

    const topic = available[Math.floor(Math.random() * available.length)];
    const slug = slugify(topic.title);

    const prompt = `You are an expert content writer for Irish hospitality businesses. Write a detailed, helpful, SEO-optimised blog article for the Rotahr website (a staff scheduling and rota management tool for Irish restaurants, bars and hotels).

Article title: "${topic.title}"

Requirements:
- 650-900 words
- Practical, actionable advice specific to Ireland (mention Irish laws, costs in EUR, Irish context where relevant)
- Written in a friendly, direct tone — like advice from an experienced industry professional
- Include 3-4 subheadings using ## for H2
- Include a brief intro paragraph and a short conclusion paragraph
- Naturally mention "Rotahr" once or twice as a helpful tool (don't oversell)
- Focus on genuinely helping Irish restaurant, bar and hotel owners
- Format in clean Markdown only — no HTML

Write the article now:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1400,
    });

    const content = completion.choices[0].message.content || '';
    const plainLines = content.split('\n').filter((l: string) => l.trim() && !l.startsWith('#'));
    const excerpt = plainLines.slice(0, 2).join(' ').slice(0, 220) + '...';

    const post = await prisma.blogPost.create({
      data: {
        slug,
        title: topic.title,
        excerpt,
        content,
        category: topic.category,
        tags: topic.tags,
        metaTitle: topic.title + ' | Rotahr',
        metaDesc: excerpt.slice(0, 160),
        published: true,
      }
    });

    console.log(`[Blog] Published: ${post.title}`);
    return NextResponse.json({ success: true, slug: post.slug, title: post.title });
  } catch (err: any) {
    console.error('Blog generation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
