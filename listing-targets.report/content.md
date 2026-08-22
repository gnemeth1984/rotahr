# Where else Rotahr can be listed

**Verified 18 August 2026.** Every URL below was fetched and checked by hand, not copied from a "100+ free directories" blog post. Those lists are mostly link farms and submitting to them costs you ranking, not gains it.

Current state: **2 listings live** (Capterra, Restaurant Resource), 4 queued, 26 new targets, 9 rejected.

---

## Do these first — free, self-serve, on-topic

| # | Target | Submit at | Why it's worth the 10 minutes |
|---|--------|-----------|-------------------------------|
| 1 | **Restaurant Inventory Management Software Directory** | [/submit](https://restaurantinventorymanagementsoftware.com/submit) | Narrow and directly on-topic. Free, editor-reviewed. Pitch the **stock + recipe costing + delivery-note scan** side, not the rota side. |
| 2 | **TrustRadius** | [vendor/products/new](https://www.trustradius.com/vendor/products/new) | The most credible free review profile after G2 and Capterra. Buyers who distrust Capterra's ad model read this one. |
| 3 | **SoftwareSuggest** | [/vendors](https://www.softwaresuggest.com/vendors) | Has an established *restaurant management* category, so you land beside the incumbents instead of in a generic SaaS bucket. Expect sales calls; ignore them. |
| 4 | **GetApp + Software Advice** | [vendors.capterra.com](https://vendors.capterra.com) | **Free win.** Same Gartner portal that published your Capterra listing. Log in and check — it often syndicates to both from one submission. |
| 5 | **AlternativeTo** | Sign in → "Suggest new application" ([FAQ](https://alternativeto.net/faq/)) | Listing Rotahr as an alternative to 7shifts / Deputy / Planday is the entire point. Community-moderated, no approval queue. |
| 6 | **PeerSpot** | [/vendors](https://www.peerspot.com/vendors) | Free vendor profile, profiles rank, and you don't need reviews just to appear. |
| 7 | **GoodFirms** | [/get-listed](https://www.goodfirms.co/get-listed) | Free tier is real and dofollow. They upsell hard after signup — take the listing, decline the rest. |
| 8 | **SaaSHub** | [/submit](https://www.saashub.com/submit) | Fast approval, dofollow. Already in your queue, still not submitted. |
| 9 | **SourceForge** (Business Software) | [/create](https://sourceforge.net/create/) | Free vendor listing, high domain authority, syndicates to Slashdot. |
| 10 | **Crunchbase** | [/add-new](https://www.crunchbase.com/add-new) | Free company profile. You're self-employed, not an Ltd — fill it as solo-founded and **don't imply funding or incorporation you don't have**. |

## Low ceiling, but two minutes each

| Target | Submit at | Note |
|--------|-----------|------|
| Launching Next | [/submit](https://www.launchingnext.com/submit/) | Small traffic, clean dofollow link, trivial form. |
| BetaList | [/submissions/new](https://betalist.com/submissions/new) | Free queue is slow but real. Submit and forget. **Don't pay to skip.** |
| Uneed | [/submit-a-tool](https://www.uneed.best/submit-a-tool) | Free slot queues, paid skips. Take the queue. |
| Crozdesk | [vendor.crozdesk.com](https://vendor.crozdesk.com/) | Now branded Revleads on the vendor side — confirm the free tier still exists before filling out a long form. |
| AskSpud.ie | [/add-your-business-ireland](https://askspud.ie/add-your-business-ireland/) | Free Irish citation. Not a software-buyer route. Do it once, never think about it again. |

## Paid — get the fee before committing

These are the highest-intent audiences on this list, which is exactly why they charge.

- **Irish Hotels Federation — Suppliers Hub.** Associate Membership puts Rotahr in the *Irish Hotel Suppliers Guide*, the book Irish hotel GMs actually consult. Best Irish audience available. Ask for the fee.
- **Northern Ireland Hotels Federation.** Trade membership = supplier directory listing + exposure in *Hotplate* magazine. NI is your natural first step outside the Republic — same island, and you already support sterling.
- **Restaurants Association of Ireland** trade partner (already queued). ~150 approved suppliers listed.

## Hold

- **Product Hunt** — one shot, can't be repeated. Wait until there are paying customers and a demo video. Warm the maker account up for a few weeks first.
- **G2** — free profile, but it ranks on review count and you have one real trial user. Low yield until there are reviews.
- **The Caterer** — highest-authority UK title here, and correspondingly hard cold. Needs a genuine news hook: funding, a named customer, or original data.

---

## Two fixes on the listing you just landed

https://www.restaurant-resource.com/software/rotahr is verified good: `robots: index, follow`, and the outbound link to rotahr.com is **dofollow** (`rel="noopener noreferrer"` only, no `nofollow`). Categorised under Accounting & Financial Management, AI & Automation, Catering & Events.

1. **The name reads "RotaHR".** It's **Rotahr**. Wrong casing splits your brand-search signal — fix it in the vendor dashboard.
2. **Reviews show 0.0 from 0 reviews**, which reads worse than no rating at all. Get two or three real users to review it and that block starts working for you.

It's also **not in their sitemap yet** (theirs was last built 6 July), so Google hasn't crawled it. Submit the URL manually in Search Console.

**madiabrains.com doesn't resolve** — no DNS at all. The closest real site is mediabrains.com, which is the network that powers Restaurant Resource. Send me the actual URL and I'll verify it the same way.

---

## What I fixed in the pipeline

Your auto-discovery had **rejected restaurant-resource.com at weight 1** — the one you just got a real dofollow link from. Root cause: the vetter judged targets from a 160-character Google snippet, and the prompt said "uncertainty is a rejection." Sparse-looking directories got binned, permanently, because a rejection row blocks re-checking forever.

Shipped in commit `e37f242` (Vercel READY):

- The vetter now **fetches the actual page** and judges the real text, plus whether the markup contains a self-serve submit route.
- Prompt rewritten: thin design is not a link farm; only reject for cost when the page actually shows a charge.
- When a page **can't be read** (Cloudflare 403s the sandbox for SaaSHub, SourceForge, Crunchbase, TrustRadius), it's parked as `needs_check` instead of `rejected` — visible and revivable rather than binned on no evidence.

Also corrected in the DB: World of Hospitality Directory is **paid** (the stored URL 404'd; the real one advertises a money-back guarantee), Prep & Profit's submit URL **doesn't exist** — auto-discovery had invented it. Both properly rejected now.
