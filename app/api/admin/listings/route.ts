import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/app/api/inbox/_auth";
import { normaliseEmail, isSuppressed } from "@/lib/email/suppression";
import { buildPageFromEmail, type BuildFromEmailResult } from "@/lib/public-page/from-email";
import { buildPageFromUrl, setPageContact } from "@/lib/public-page/from-url";
import { discoverContacts } from "@/lib/public-page/contact-discovery";
import { renderListingInvite, LISTING_INVITED_STATUS } from "@/lib/outreach/listing-invite";
import { sendOutreachEmail } from "@/lib/outreach/brevo";

/**
 * Paste-and-go listings tool.
 *
 * Two separate actions on purpose:
 *
 *   build  — enrich an address and publish the page. Reversible, silent, nobody
 *            outside Rotahr learns anything happened.
 *   send   — tell the venue the page exists. Irreversible.
 *
 * They are not one button because a cold email announcing a page that has the
 * wrong address on it cannot be recalled, and the only way to know the page is
 * right is to look at it. So build, look, then send.
 *
 * `discard` deletes a page we created in error. It deliberately does NOT write a
 * ListingTakedown row: a takedown is a venue's decision and permanently blocks
 * republishing, whereas a bad extraction should be fixable by rebuilding from a
 * better URL. Venue-requested removal goes through /api/listing/takedown.
 */

export const maxDuration = 300;

/** One address at a time on the client, but accept a paste of many. */
function parseEmails(raw: unknown): string[] {
  const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.join("\n") : "";
  const found = text
    .split(/[\s,;]+/)
    .map((s) => normaliseEmail(s.replace(/^mailto:/i, "").replace(/[<>()]/g, "")))
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
  return Array.from(new Set(found)).slice(0, 25);
}

export async function GET() {
  const { error } = await requirePlatformAdmin();
  if (error) return error;

  const pages = await prisma.business.findMany({
    where: { publicProspect: true },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      publicSlug: true,
      publicEmail: true,
      publicNoIndex: true,
      publicTakedownToken: true,
      createdAt: true,
      venues: { take: 1, select: { address: true } },
    },
  });

  const emails = pages.map((p) => p.publicEmail).filter((e): e is string => Boolean(e));
  const leads = emails.length
    ? await prisma.outreachLead.findMany({
        where: { email: { in: emails } },
        select: { email: true, status: true, lastContacted: true },
      })
    : [];
  const leadByEmail = new Map(leads.map((l) => [l.email, l]));

  return NextResponse.json({
    pages: pages.map((p) => {
      const lead = p.publicEmail ? leadByEmail.get(p.publicEmail) : undefined;
      return {
        id: p.id,
        name: p.name,
        slug: p.publicSlug,
        email: p.publicEmail,
        address: p.venues[0]?.address || null,
        noIndex: p.publicNoIndex,
        invited: lead?.status === LISTING_INVITED_STATUS,
        leadStatus: lead?.status || null,
        lastContacted: lead?.lastContacted?.toISOString() || null,
        createdAt: p.createdAt.toISOString(),
      };
    }),
  });
}

export async function POST(req: Request) {
  const { error } = await requirePlatformAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = typeof body.action === "string" ? body.action : "build";

  if (action === "build") {
    const emails = parseEmails(body.emails);
    if (emails.length === 0) {
      return NextResponse.json({ error: "No valid email addresses in that." }, { status: 400 });
    }

    // A single address may come with a hand-supplied URL/name; a bulk paste
    // can't, because the override would be wrong for every row but one.
    const single = emails.length === 1;
    const sourceUrl = single && typeof body.sourceUrl === "string" ? body.sourceUrl : null;
    const name = single && typeof body.name === "string" ? body.name : null;

    // Sequential, not Promise.all: each build fetches a site and calls the
    // model, and firing 25 of those at once gets us rate-limited by both.
    const results: (BuildFromEmailResult & { email: string })[] = [];
    for (const email of emails) {
      try {
        const r = await buildPageFromEmail({ email, sourceUrl, name });
        results.push({ ...r, email });
      } catch (e) {
        results.push({
          ok: false,
          email,
          error: e instanceof Error ? e.message : "Build failed.",
        });
      }
    }

    return NextResponse.json({
      results: results.map((r) =>
        r.ok
          ? {
              ok: true as const,
              email: r.email,
              businessId: r.businessId,
              slug: r.slug,
              name: r.name,
              sourceUrl: r.sourceUrl,
                  address: r.extracted.address ?? null,
              warnings: r.warnings,
            }
          : { ok: false as const, email: r.email, error: r.error, needsUrl: r.needsUrl === true }
      ),
    });
  }

  // Build from a URL instead of an address: a Google Maps pin, a Facebook page,
  // a website. Email optional — see lib/public-page/from-url.ts for what a page
  // without one can and can't do.
  if (action === "build_url") {
    // Split on WHITESPACE ONLY. A URL cannot contain a space, but commas and
    // semicolons are perfectly legal in one — and Google Maps puts commas in
    // the coordinates (@53.3419,-6.2687,17z). Splitting on commas shredded
    // every Maps link into three useless fragments.
    const urls = String(typeof body.urls === "string" ? body.urls : "")
      .split(/\s+/)
      .map((s) => s.trim().replace(/^[<(]|[>)]$/g, ""))
      .filter((s) => s.length > 3 && /\./.test(s))
      .slice(0, 10);
    if (urls.length === 0) {
      return NextResponse.json({ error: "No usable links in that." }, { status: 400 });
    }

    const single = urls.length === 1;
    const name = single && typeof body.name === "string" ? body.name : null;
    const email = single && typeof body.email === "string" ? body.email : null;
    const discover = body.discover !== false;

    const out: Record<string, unknown>[] = [];
    for (const url of urls) {
      try {
        const r = await buildPageFromUrl({ url, name, email, discover });
        out.push(
          r.ok
            ? {
                ok: true,
                url,
                businessId: r.businessId,
                slug: r.slug,
                name: r.name,
                email: r.email,
                needsContact: r.needsContact,
                address: r.extracted.address ?? null,
                phone: r.extracted.phone ?? null,
                warnings: r.warnings,
                contacts: r.contacts,
              }
            : { ok: false, url, error: r.error, contacts: r.contacts ?? null }
        );
      } catch (e) {
        out.push({ ok: false, url, error: e instanceof Error ? e.message : "Build failed." });
      }
    }
    return NextResponse.json({ results: out });
  }

  // Re-run discovery against a page that has no contact yet.
  if (action === "discover") {
    const businessId = typeof body.businessId === "string" ? body.businessId : "";
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        name: true,
        publicWebsite: true,
        publicFacebook: true,
        publicInstagram: true,
        publicPhone: true,
      },
    });
    if (!biz) return NextResponse.json({ error: "No page with that id." }, { status: 404 });
    if (!biz.publicWebsite && !biz.publicFacebook && !biz.publicInstagram) {
      return NextResponse.json(
        { error: "No website, Facebook or Instagram on this page — nowhere to look." },
        { status: 400 }
      );
    }
    const contacts = await discoverContacts({
      name: biz.name,
      website: biz.publicWebsite,
      facebook: biz.publicFacebook,
      instagram: biz.publicInstagram,
      knownPhone: biz.publicPhone,
    });
    return NextResponse.json({ ok: true, contacts });
  }

  if (action === "set_contact") {
    const businessId = typeof body.businessId === "string" ? body.businessId : "";
    const email = typeof body.email === "string" ? body.email : "";
    const r = await setPageContact(businessId, email);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, email: r.email });
  }

  if (action === "send") {
    const businessId = typeof body.businessId === "string" ? body.businessId : "";
    if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });

    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        publicSlug: true,
        publicEmail: true,
        publicProspect: true,
        publicTakedownToken: true,
        venues: { take: 1, select: { address: true } },
      },
    });
    if (!biz || !biz.publicProspect) {
      return NextResponse.json({ error: "No prospect page with that id." }, { status: 404 });
    }
    if (!biz.publicSlug || !biz.publicTakedownToken || !biz.publicEmail) {
      // Sending an invite whose links don't work is worse than not sending.
      return NextResponse.json(
        { error: "That page is missing a slug, email or takedown token — can't send." },
        { status: 400 }
      );
    }
    if (await isSuppressed(biz.publicEmail)) {
      return NextResponse.json({ error: "That address has unsubscribed." }, { status: 400 });
    }

    const existingLead = await prisma.outreachLead.findUnique({
      where: { email: biz.publicEmail },
      select: { id: true, status: true, contactCount: true },
    });
    if (existingLead?.status === LISTING_INVITED_STATUS) {
      return NextResponse.json({ error: "Already invited." }, { status: 400 });
    }
    if (existingLead && ["bounced", "unsubscribed"].includes(existingLead.status)) {
      return NextResponse.json(
        { error: `Lead is ${existingLead.status} — not sending.` },
        { status: 400 }
      );
    }

    // Venue rows have no city column, so the city in the subject line is only
    // ever one the admin typed. Left out rather than guessed from the address.
    const city = typeof body.city === "string" && body.city.trim() ? body.city.trim() : undefined;
    const hook = typeof body.hook === "string" && body.hook.trim() ? body.hook.trim() : undefined;

    const content = renderListingInvite({
      name: biz.name,
      email: biz.publicEmail,
      slug: biz.publicSlug,
      takedownToken: biz.publicTakedownToken,
      city,
      hook,
    });

    const sent = await sendOutreachEmail({
      to: biz.publicEmail,
      toName: biz.name,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tags: ["listing_invite"],
    });

    if (!sent.ok) {
      if (sent.hardBounce) {
        await prisma.outreachLead.upsert({
          where: { email: biz.publicEmail },
          create: {
            email: biz.publicEmail,
            name: biz.name,
            city: city || "",
            status: "bounced",
            bouncedAt: new Date(),
            source: "listing_invite",
          },
          update: { status: "bounced", bouncedAt: new Date() },
        });
      }
      return NextResponse.json({ error: sent.error || "Send failed." }, { status: 502 });
    }

    // Parked on `listing_invited`, which matches no branch in
    // findEligibleLeads — so the weekday cron cannot fold these into the
    // five-step product pitch.
    const lead = await prisma.outreachLead.upsert({
      where: { email: biz.publicEmail },
      create: {
        email: biz.publicEmail,
        name: biz.name,
        city: city || "",
        status: LISTING_INVITED_STATUS,
        contactCount: 1,
        lastContacted: new Date(),
        source: "listing_invite",
      },
      update: {
        status: LISTING_INVITED_STATUS,
        contactCount: { increment: 1 },
        lastContacted: new Date(),
      },
    });

    await prisma.outreachSend
      .create({
        data: {
          leadId: lead.id,
          email: biz.publicEmail,
          step: LISTING_INVITED_STATUS,
          subject: content.subject,
          messageId: sent.messageId,
        },
      })
      .catch(() => undefined);

    return NextResponse.json({ ok: true, subject: content.subject, to: biz.publicEmail });
  }

  if (action === "preview") {
    const businessId = typeof body.businessId === "string" ? body.businessId : "";
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        name: true,
        publicSlug: true,
        publicEmail: true,
        publicTakedownToken: true,
        venues: { take: 1, select: { address: true } },
      },
    });
    if (!biz?.publicSlug || !biz.publicEmail || !biz.publicTakedownToken) {
      return NextResponse.json({ error: "Page not ready to preview." }, { status: 400 });
    }
    const hook = typeof body.hook === "string" && body.hook.trim() ? body.hook.trim() : undefined;
    const content = renderListingInvite({
      name: biz.name,
      email: biz.publicEmail,
      slug: biz.publicSlug,
      takedownToken: biz.publicTakedownToken,
      city: typeof body.city === "string" && body.city.trim() ? body.city.trim() : undefined,
      hook,
    });
    return NextResponse.json({ ok: true, ...content, to: biz.publicEmail });
  }

  if (action === "discard") {
    const businessId = typeof body.businessId === "string" ? body.businessId : "";
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        publicProspect: true,
        _count: { select: { users: true, employees: true } },
      },
    });
    if (!biz) return NextResponse.json({ ok: true, alreadyGone: true });
    // Only ever an unclaimed prospect. Once someone owns it, deletion is an
    // account operation and does not belong behind an admin convenience button.
    if (!biz.publicProspect || biz._count.users > 0 || biz._count.employees > 0) {
      return NextResponse.json(
        { error: "That business is claimed — delete it from account settings, not here." },
        { status: 400 }
      );
    }
    await prisma.business.delete({ where: { id: biz.id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
