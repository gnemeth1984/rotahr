# rotahr.com email DNS — state and the DMARC change

Measured 2026-08-12. DNS is hosted at Vercel (`ns1/ns2.vercel-dns.com`), so every
change below is made in **Vercel → Domains → rotahr.com → DNS**.

## Who sends as @rotahr.com

| Sender | Used for | SPF | DKIM | DMARC result |
|---|---|---|---|---|
| **Resend** | in-app transactional (bookings, reminders, resets) | `send.rotahr.com` = `include:amazonses.com` (bounce domain) | `resend._domainkey.rotahr.com` present | **passes** on DKIM alignment |
| **Brevo** | cold outreach from `sales@rotahr.com` | root has `include:spf.brevo.com` | `brevo1._domainkey` + `brevo2._domainkey` CNAMEs resolve to live keys; Brevo API reports `authenticated: true, verified: true` | **passes** |
| **Namecheap Private Email** | mail Gabor sends by hand from the `sales@` mailbox (MX = `mx1/mx2.privateemail.com`) | `include:spf.privateemail.com` added 12 Aug | `privateemail._domainkey` added 12 Aug, 2048-bit | **passes** |

Current root SPF: `v=spf1 include:spf.privateemail.com include:spf.brevo.com ~all`
Current DMARC: `v=DMARC1; p=quarantine; sp=quarantine; adkim=r; aspf=r; pct=100; rua=mailto:gnemeth1984@gmail.com`

All three senders aligned and DMARC moved to `p=quarantine` on 12 Aug 2026,
verified on both Google and Cloudflare resolvers. The section below is kept as
the record of why it was not safe earlier.

## Why p=quarantine was not safe before 12 Aug

Two of the three senders align. The third does not: anything typed by hand in the
`sales@rotahr.com` mailbox — including the link-building pitches, which are sent
one at a time on purpose — fails SPF *and* DKIM. Under `p=none` that is invisible.
Under `p=quarantine` those messages go to junk, and they are the ones where a human
reply is the entire point.

## Do these two first

Both were done on 12 Aug 2026. Kept for the record.

**1. Add Private Email to root SPF.** Replace the root `TXT @` SPF value with:

```
v=spf1 include:spf.brevo.com include:spf.privateemail.com ~all
```

Keep the separate `brevo-code:e3780163856cb1297fb42adc4ea84c19` TXT record as-is —
it is a different record, not part of SPF. DNS lookup cost after the change is 5 of
the permitted 10 (`spf.brevo.com` is 1, all-ip4; `spf.privateemail.com` nests 3).

**2. Turn on DKIM for Private Email.** Namecheap → Private Email → the rotahr.com
domain → enable DKIM, then add the TXT record it gives you at Vercel. The host
Namecheap issues is `privateemail._domainkey`, not the `default._domainkey` most
guides assume. Paste the **DNS Record** value (`v=DKIM1;k=rsa;p=…`), not the
Public Key box underneath it — that one omits the `v=DKIM1;k=rsa;p=` prefix and
will not validate.

## Then flip DMARC

Done 12 Aug 2026. The `_dmarc` TXT record is:

```
v=DMARC1; p=quarantine; sp=quarantine; adkim=r; aspf=r; pct=100; rua=mailto:gnemeth1984@gmail.com
```

`pct=100` only after a week of clean aggregate reports; start at `pct=25` if you
would rather ramp. Relaxed alignment (`adkim=r`) is what lets Resend's
`send.rotahr.com` bounce domain pass.

## Verify

```bash
curl -s "https://dns.google/resolve?name=_dmarc.rotahr.com&type=TXT"
curl -s "https://dns.google/resolve?name=privateemail._domainkey.rotahr.com&type=TXT"
curl -s "https://api.brevo.com/v3/senders/domains/rotahr.com" -H "api-key: $BREVO_API_KEY"
```

A Vercel API token cannot do any of this unless it is **account-scoped**: the
project-scoped token in `.env.local` gets `forbidden` from
`/v4/domains/rotahr.com/records` and `/v5/domains`.

## Reading the reports

Aggregate reports arrive at `gnemeth1984@gmail.com` as daily XML attachments,
one per reporting provider, starting roughly 24-48h after the policy change.
They are machine-readable rather than pleasant, and the only line that matters
per record is whether `dkim` and `spf` both say `pass`.

What to watch for in the first fortnight:

- A source IP you do not recognise failing both. Usually a forgotten service
  still sending as `@rotahr.com` - the policy is now junking its mail.
- Mailing lists and forwarders fail SPF by design, because the forwarder sends
  from its own IP. They pass DKIM if the body was not modified, and `adkim=r`
  keeps that passing. This is why the policy is `quarantine` and not `reject`.

Only move to `p=reject` after a clean fortnight, and only if there is a reason
to - `quarantine` already stops the impersonation that matters to a business
this size.
