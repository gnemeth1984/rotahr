# Task: Port Blog Comment Assistant to rotahr.com

## Goal
- Research new competitors (Rotaready, Homebase, HotSchedules, Fourth, Harri, Sling, Connecteam, R365 done) + new comment threads for them (done via web_search).
- Move the "Blog Comment Assistant" tool (currently a separate sandbox app at rotahr-linkedin-assistant / rotahrl-pit18p2.runable.site) into the main rotahr Next.js app so it's hosted at rotahr.com/blog-comments, same pattern as /pitch and /blog.

## Done
- Added BlogCommentArticle + BlogCommentDraft Prisma models, pushed to Neon (`npx prisma db push`).
- lib/ai/blog-comments.ts — system prompt + generateBlogComment() using OpenAI gpt-4o.
- app/api/blog-comments/articles/route.ts — GET/POST bulk/DELETE, gated by isSuperAdminEmail.
- Researched extra competitors + new reddit threads (Homebase, HotSchedules, Sling, Connecteam, Harri, Rotaready-no-reddit-hits-yet).

## TODO (next steps)
1. app/api/blog-comments/generate/route.ts — POST { articleId?, articleTitle, articleUrl, articleSnippet, note } -> calls generateBlogComment, saves BlogCommentDraft, returns draft.
2. app/api/blog-comments/drafts/route.ts — GET recent drafts, DELETE by id.
3. app/blog-comments/page.tsx — client page: add-articles textarea (paste URLs, POST bulk), article list with topic/region/platform badges, "Generate Comment" button per article + note field, recent drafts list with delete. Gate page itself: redirect/show nothing if not super admin (check session client-side via useSession, or make it a server component checking session and rendering nothing/403 if not admin).
4. Seed script: insert original 37 + my 40 (batch2) + new competitor batch (~15-18, see below) into Postgres via this new schema (adapt seed-batch2.ts data, but written as a one-off script using @/lib/db or a plain pg script run with `npx tsx` or via a temporary API call).
5. Nav: do NOT add to public nav — keep unlisted, just like reasoning for privacy. Confirm with Gabor if he wants a nav link.
6. Commit + push to GitHub (rotahr repo), deploy via Vercel (already has auto-deploy on push per memory), verify at https://rotahr.com/blog-comments.
7. Tell Gabor the old separate tool (sandbox app) still exists too — decide if he wants to keep using both or just the new rotahr.com one going forward.

## New competitor threads found (to seed, in addition to original 77)
- r/KitchenConfidential 171lz04 "Anyone use Homebase" - Homebase
- r/Payroll 1pdbtz5 "Anyone here switch from Gusto to Homebase? Worth it?" - Homebase
- r/smallbusiness 130n5oq "Homebase for Payroll?" - Homebase
- r/smallbusiness 1kkfcpn "Connecteam - Too good to be true? (Small Business Plan)" - Connecteam, Homebase
- r/restaurantowners 1kocy4t "Does anyone here use Sling for scheduling?" - Sling, HotSchedules
- r/needadvice 1cgeufb "Is Sling app (for employee shift scheduling) safe?" - Sling
- r/ToastPOS 1o158x9 "Sling?" - Sling
- r/TimeTrackingSoftware 1hhcwcg "Honest Review: 7Shifts" - 7shifts
- r/Restaurant_Managers 1o23z4r "Free Scheduling/Messaging Apps" - Sling
- r/restaurantowners 1i5ctkz "Square for Restaurants" - Sling, Toast
- r/Connecteam 1pfpkdf "How to Boost Communication in Hospitality" - Connecteam
- r/Connecteam 1hlzmwd "Maximize Fair Tip Distribution with Connecteam's..." - Connecteam
- r/restaurateur oecn6f "Has anyone used Harri?" - Harri
- r/restaurantowners 1b1q0xd "Alternatives to ADP?" - ADP/payroll context
- r/ToastPOS 1j9o3ra "Need opinions on Toast please" - HotSchedules mentioned

Rotaready: no reddit threads found yet (mostly review-site content, not reddit) — still added as a tracked competitor name in the AI context so future threads get caught.

## Decisions made
- No auth-wall on public pages like /pitch, but THIS tool is gated (isSuperAdminEmail) since it's an internal outreach tool, not public content.
- Kept both Prisma models flat (no Business relation) — single-user internal tool, not tenant-scoped.
