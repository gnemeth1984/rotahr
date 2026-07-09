import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Legacy Ireland-specific topics (kept for slug/history continuity — not used for new selection)
const IRISH_TOPICS: { title: string; category: string; tags: string; region?: string }[] = [
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

// General topics — applicable to hospitality businesses anywhere (US, UK, Ireland, elsewhere). No country-specific legal claims.
const GENERAL_TOPICS: { title: string; category: string; tags: string; region: string }[] = [
  { title: "How to Build a Staff Rota That Actually Works", category: "scheduling", tags: "rota,scheduling,restaurant,hospitality", region: "general" },
  { title: "Reducing Staff Turnover in Restaurants and Hotels", category: "hr", tags: "staff retention,hospitality,hr", region: "general" },
  { title: "HACCP and Food Safety Compliance: A Practical Checklist", category: "compliance", tags: "haccp,food safety,compliance,hospitality", region: "general" },
  { title: "Managing Seasonal Staff in Restaurants and Hotels", category: "scheduling", tags: "seasonal staff,hotel,restaurant", region: "general" },
  { title: "Agency Staff vs Permanent Hire: What It Really Costs a Restaurant", category: "costs", tags: "agency staff,costs,restaurant", region: "general" },
  { title: "Tips and Tronc Systems Explained for Hospitality Businesses", category: "payroll", tags: "tips,tronc,payroll,restaurant", region: "general" },
  { title: "How to Handle Last-Minute Staff Callouts in a Busy Restaurant", category: "scheduling", tags: "callouts,scheduling,restaurant", region: "general" },
  { title: "Scheduling Software vs Spreadsheets: What Restaurants Actually Save", category: "scheduling", tags: "scheduling software,spreadsheets,restaurant", region: "general" },
  { title: "Restaurant Manager Burnout: Signs, Causes and Fixes", category: "hr", tags: "burnout,manager,hospitality", region: "general" },
  { title: "How to Run a Profitable Bar: A Cost Control Guide", category: "finance", tags: "bar,profit,costs", region: "general" },
  { title: "Onboarding New Kitchen Staff Quickly and Effectively", category: "hr", tags: "onboarding,kitchen staff,training", region: "general" },
  { title: "The True Cost of a No-Show Shift in Hospitality", category: "costs", tags: "no show,costs,hospitality", region: "general" },
  { title: "Restaurant Technology: Tools Every Modern Venue Should Use", category: "technology", tags: "technology,restaurant,software", region: "general" },
  { title: "How to Calculate Labour Cost as a Percentage of Revenue", category: "finance", tags: "labour cost,revenue,restaurant,finance", region: "general" },
  { title: "Best Practices for Time-Off Requests in Hospitality Teams", category: "hr", tags: "time off,holidays,hospitality", region: "general" },
  { title: "Managing a Multi-Venue Hospitality Business", category: "management", tags: "multi venue,management,hospitality", region: "general" },
  { title: "Restaurant Staff Communication: Group Chats vs Proper Systems", category: "management", tags: "communication,restaurant", region: "general" },
  { title: "How to Cut Overtime Costs Without Losing Staff", category: "costs", tags: "overtime,costs,restaurant", region: "general" },
  { title: "Handling Staff Disputes in a Restaurant or Bar", category: "hr", tags: "disputes,hr,restaurant", region: "general" },
  { title: "Building a Back-of-House Team for a New Restaurant", category: "hr", tags: "kitchen,team,new restaurant", region: "general" },
  { title: "Front of House Training Tips for Restaurant Managers", category: "hr", tags: "front of house,training,restaurant", region: "general" },
  { title: "Using Data to Improve Your Restaurant Rota", category: "scheduling", tags: "data,rota,scheduling,restaurant", region: "general" },
  { title: "Retaining Your Best Chefs in a Competitive Market", category: "hr", tags: "chefs,retention,kitchen", region: "general" },
  { title: "Rota Apps vs Paper: The Real Difference for Any Venue", category: "scheduling", tags: "rota app,paper,venue", region: "general" },
  { title: "Clocking In Systems for Restaurants: What You Need to Know", category: "technology", tags: "clock in,restaurant,technology", region: "general" },
  { title: "How to Build a Hospitality Business From Scratch", category: "management", tags: "hospitality,startup,business", region: "general" },
  { title: "Rota Planning for Public Holidays in Bars and Pubs", category: "scheduling", tags: "public holiday,pub,bar,rota", region: "general" },
  { title: "How to Train a New Bar Manager", category: "hr", tags: "bar manager,training,pub", region: "general" },
  { title: "How Rotahr Helps Restaurant Owners Save Time Every Week", category: "product", tags: "rotahr,scheduling,restaurant,time saving", region: "general" },
  { title: "What Is a Rota and How Should Any Hospitality Business Use One", category: "scheduling", tags: "rota,scheduling,beginner", region: "general" },
  { title: "Staff Availability Management for Hospitality Venues", category: "scheduling", tags: "availability,staff,hospitality", region: "general" },
  { title: "Menu Engineering: Pricing Dishes for Profit, Not Just Cost", category: "finance", tags: "menu engineering,pricing,restaurant", region: "general" },
  { title: "How to Forecast Demand for Better Staff Scheduling", category: "scheduling", tags: "forecasting,demand,scheduling", region: "general" },
  { title: "Cross-Training Staff: Building a More Flexible Team", category: "hr", tags: "cross training,team,flexibility", region: "general" },
  { title: "Reducing No-Show Reservations Without Annoying Guests", category: "management", tags: "no show,reservations,bookings", region: "general" },
];

// US-specific compliance/market topics
const US_TOPICS: { title: string; category: string; tags: string; region: string }[] = [
  { title: "US Restaurant Labor Laws: What Owners Need to Know", category: "compliance", tags: "labor law,us,restaurant,compliance", region: "us" },
  { title: "Tip Credit and Minimum Wage Rules for US Restaurants", category: "compliance", tags: "tip credit,minimum wage,us,restaurant", region: "us" },
  { title: "Overtime Rules for Hourly Restaurant Staff in the US", category: "compliance", tags: "overtime,us,restaurant,hourly", region: "us" },
  { title: "Predictive Scheduling Laws: What US Restaurant Owners Should Know", category: "compliance", tags: "predictive scheduling,us,restaurant,law", region: "us" },
  { title: "How US Restaurants Handle Payroll Taxes and Tip Reporting", category: "payroll", tags: "payroll,tips,us,restaurant,tax", region: "us" },
];

// UK-specific compliance/market topics
const UK_TOPICS: { title: string; category: string; tags: string; region: string }[] = [
  { title: "UK Employment Law Basics for Hospitality Employers", category: "compliance", tags: "employment law,uk,hospitality,compliance", region: "uk" },
  { title: "National Minimum Wage Rules for UK Hospitality Staff", category: "compliance", tags: "minimum wage,uk,hospitality", region: "uk" },
  { title: "Zero-Hour Contracts in the UK: Rules for Hospitality Employers", category: "compliance", tags: "zero hour contracts,uk,employment law", region: "uk" },
  { title: "Tronc and Tipping Rules Under the UK's Tipping Act", category: "payroll", tags: "tronc,tipping,uk,payroll", region: "uk" },
  { title: "Bank Holiday Pay and Scheduling for UK Hospitality Venues", category: "compliance", tags: "bank holiday,uk,scheduling,pay", region: "uk" },
];

const TOPICS = [...GENERAL_TOPICS, ...US_TOPICS, ...UK_TOPICS];

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
    const region = (topic as any).region || "general";
    const currentYear = new Date().getFullYear();

    const regionContext =
      region === "us"
        ? `Write for a US audience. Reference US federal/state-level context where relevant (mention that specific rules vary by state, use USD for costs), and keep legal claims general/high-level rather than citing specific statutes that could be outdated — advise readers to confirm current state rules.`
        : region === "uk"
        ? `Write for a UK audience. Reference UK-wide context (use GBP for costs), and keep legal claims general/high-level rather than citing specific outdated figures — advise readers to confirm current HMRC/gov.uk guidance.`
        : `Write for a general, international hospitality audience (US, UK, Ireland and beyond). Do not lock the advice to one country's laws or currency — keep guidance universally applicable, and where a legal/regulatory point is genuinely region-specific, note that rules vary by country/state and to check local requirements.`;

    const prompt = `You are an expert content writer for hospitality businesses worldwide. Write a detailed, helpful, SEO-optimised blog article for the Rotahr website (a staff scheduling, bookings, and payroll tool for restaurants, bars and hotels).

Article title: "${topic.title}"

${regionContext}

Requirements:
- 650-900 words
- Practical, actionable, and factually current advice — this is being published in ${currentYear}, so avoid stale or outdated claims (no references to old years' figures unless explicitly historical); if unsure whether a specific number/rule is still accurate, speak generally instead of guessing a stale figure
- Written in a friendly, direct tone — like advice from an experienced industry professional
- Include 3-4 subheadings using ## for H2
- Include a brief intro paragraph and a short conclusion paragraph
- Naturally mention "Rotahr" once or twice as a helpful tool (don't oversell)
- Focus on genuinely helping restaurant, bar and hotel owners anywhere they operate
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
