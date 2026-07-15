// @ts-nocheck
import { prisma } from "../lib/db";
import fs from "fs";
import path from "path";

const existing = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "scripts", "existing-articles.json"), "utf-8")
);

const newCompetitorBatch = [
  { title: "Anyone use Homebase", url: "https://www.reddit.com/r/KitchenConfidential/comments/171lz04/anyone_use_homebase/", snippet: "Kitchen worker asking if anyone uses Homebase for scheduling; comment says it's pretty solid, better than paper for small staff.", topic: "scheduling", region: "us" },
  { title: "Anyone here switch from Gusto to Homebase? Worth it?", url: "https://www.reddit.com/r/Payroll/comments/1pdbtz5/anyone_here_switch_from_gusto_to_homebase_worth_it/", snippet: "Business on Gusto for 2 years, clean interface, considering switching to Homebase — asking if worth it.", topic: "payroll / scheduling", region: "us" },
  { title: "Homebase for Payroll?", url: "https://www.reddit.com/r/smallbusiness/comments/130n5oq/homebase_for_payroll/", snippet: "Owner using Homebase for time-keeping, asking about their payroll service vs current provider Paycor.", topic: "payroll", region: "us" },
  { title: "Connecteam - Too good to be true? (Small Business Plan)", url: "https://www.reddit.com/r/smallbusiness/comments/1kkfcpn/connecteam_too_good_to_be_true_small_business_plan/", snippet: "Small business (<10 employees) asking about Connecteam's small business plan, comparing to Homebase feature set.", topic: "scheduling / HR software", region: "general" },
  { title: "Does anyone here use Sling for scheduling?", url: "https://www.reddit.com/r/restaurantowners/comments/1kocy4t/does_anyone_here_use_sling_for_scheduling/", snippet: "Owner considering switching from HotSchedules to Sling, noting Sling lacks specific position assignments HotSchedules has.", topic: "scheduling", region: "us" },
  { title: "Is Sling app (for employee shift scheduling) safe?", url: "https://www.reddit.com/r/needadvice/comments/1cgeufb/is_sling_app_for_employee_shift_scheduling_safe/", snippet: "Employee asking about privacy/geofencing concerns being asked to use Sling for shift scheduling.", topic: "scheduling / employee concerns", region: "general" },
  { title: "Sling?", url: "https://www.reddit.com/r/ToastPOS/comments/1o158x9/sling/", snippet: "Toast POS user asking if Sling scheduling has improved after a bad experience a year ago.", topic: "scheduling / POS integration", region: "us" },
  { title: "Honest Review: 7Shifts", url: "https://www.reddit.com/r/TimeTrackingSoftware/comments/1hhcwcg/honest_review_7shifts/", snippet: "Detailed review of 7shifts strengths (scheduling, team communication, time-tracking) and flaws for restaurants.", topic: "scheduling review", region: "us" },
  { title: "Free Scheduling/Messaging Apps", url: "https://www.reddit.com/r/Restaurant_Managers/comments/1o23z4r/free_schedulingmessaging_apps/", snippet: "Manager asking about free scheduling/messaging apps; comment recalls using Sling for free with most features a couple years back.", topic: "scheduling", region: "us" },
  { title: "Square for Restaurants", url: "https://www.reddit.com/r/restaurantowners/comments/1i5ctkz/square_for_restaurants/", snippet: "Owner discussing Square for Restaurants integration issues, mentions using Sling and Toast scheduling/payroll not syncing hours properly.", topic: "POS / scheduling integration", region: "us" },
  { title: "How to Boost Communication in Hospitality (and Why It Matters)", url: "https://www.reddit.com/r/Connecteam/comments/1pfpkdf/how_to_boost_communication_in_hospitality_and_why/", snippet: "Post about hospitality team communication tools, Connecteam pitching its scheduling/chat/task features for hospitality teams.", topic: "team communication", region: "general" },
  { title: "Maximize Fair Tip Distribution with Connecteam's Tip Pooling Calculator", url: "https://www.reddit.com/r/Connecteam/comments/1hlzmwd/maximize_fair_tip_distribution_with_connecteams/", snippet: "Post about Connecteam's tip pooling calculator for restaurant managers and hospitality staff.", topic: "tip pooling / payroll", region: "general" },
  { title: "Has anyone used Harri?", url: "https://www.reddit.com/r/restaurateur/comments/oecn6f/has_anyone_used_harri/", snippet: "Owner asking about Harri end-to-end hiring/onboarding; comment compares it to a $99/mo all-in-one alternative with scheduling and messaging.", topic: "hiring / HR software", region: "us" },
  { title: "Alternatives to ADP?", url: "https://www.reddit.com/r/restaurantowners/comments/1b1q0xd/alternatives_to_adp/", snippet: "Restaurant currently on ADP for timekeeping/payroll asking about alternatives, considering upgrades.", topic: "payroll", region: "us" },
  { title: "Need opinions on Toast please", url: "https://www.reddit.com/r/ToastPOS/comments/1j9o3ra/need_opinions_on_toast_please/", snippet: "Owner asking for opinions on Toast POS; comment mentions using HotSchedules alongside Toast and high credit card processing fees.", topic: "POS / scheduling", region: "us" },
];

async function main() {
  let count = 0;

  for (const a of existing) {
    await prisma.blogCommentArticle.create({
      data: {
        title: a.title,
        url: a.url,
        snippet: a.snippet || null,
        topic: a.topic || null,
        region: a.region || null,
        source: "user",
        hasComments: a.hasComments ?? null,
        commentPlatform: a.commentPlatform || "reddit",
      },
    });
    count++;
  }

  for (const a of newCompetitorBatch) {
    await prisma.blogCommentArticle.create({
      data: {
        title: a.title,
        url: a.url,
        snippet: a.snippet,
        topic: a.topic,
        region: a.region,
        source: "user",
        hasComments: true,
        commentPlatform: "reddit",
      },
    });
    count++;
  }

  console.log(`Seeded ${count} articles.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
