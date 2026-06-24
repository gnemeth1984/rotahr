# Rotahr Full Audit — Fixes Needed

## Issues Found

### 1. CRITICAL - Vercel Blob hostname missing from next.config
Blob receipt images won't render via Next.js Image component.
- Add `*.public.blob.vercel-storage.com` and `*.vercel-storage.com` to remotePatterns

### 2. HIGH - Forgot password email sends from `onboarding@resend.dev`
Should send from `noreply@rotahr.com` or `team@rotahr.com` (verified Resend domain).
Fix: `app/api/auth/forgot-password/route.ts`

### 3. HIGH - /settings has no index page  
Navigating to /settings gives a 404. Sidebar links to /settings/venues.
Fix: Add redirect from /settings → /settings/venues

### 4. MEDIUM - No OPENAI_API_KEY env check in next.config
No image domain for Vercel Blob presigned URLs in next.config (for <Image> tags)

### 5. INFO - Two separate Prisma clients (lib/db vs lib/prisma)
Both use globalThis singleton so no real risk, but messy.
Fix: Make lib/prisma.ts re-export from lib/db to consolidate

### 6. INFO - Google OAuth user onboarding - session not refreshed after business creation
Fixed in previous session (window.location.href reload) ✓

## Status
- [ ] next.config blob hostname fix
- [ ] forgot-password email sender fix  
- [ ] /settings redirect page
- [ ] lib/prisma consolidation
