# rotahr.com email DNS — state and the DMARC change

Measured 2026-08-12. DNS is hosted at Vercel (`ns1/ns2.vercel-dns.com`), so every
change below is made in **Vercel → Domains → rotahr.com → DNS**.

## Who sends as @rotahr.com

| Sender | Used for | SPF | DKIM | DMARC result |
|---|---|---|---|---|
| **Resend** | in-app transactional (bookings, reminders, resets) | `send.rotahr.com` = `include:amazonses.com` (bounce domain) | `resend._domainkey.rotahr.com` present | **passes** on DKIM alignment |
| **Brevo** | cold outreach from `sales@rotahr.com` | root has `include:spf.brevo.com` | `brevo1._domainkey` + `brevo2._domainkey` CNAMEs resolve to live keys; Brevo API reports `authenticated: true, verified: true` | **passes** |
| **Namecheap Private Email** | mail Gabor sends by hand from the `sales@` mailbox (MX = `mx1/mx2.privateemail.com`) | **not in root SPF** | **no DKIM record** (`default._domainkey` = NXDOMAIN) | **fails both** |

Current root SPF: `v=spf1 include:spf.brevo.com ~all`
Current DMARC: `v=DMARC1; p=none; rua=mailto:gnemeth1984@gmail.com`

## Why p=quarantine is not safe yet

Two of the three senders align. The third does not: anything typed by hand in the
`sales@rotahr.com` mailbox — including the link-building pitches, which are sent
one at a time on purpose — fails SPF *and* DKIM. Under `p=none` that is invisible.
Under `p=quarantine` those messages go to junk, and they are the ones where a human
reply is the entire point.

## Do these two first

**1. Add Private Email to root SPF.** Replace the root `TXT @` SPF value with:

```
v=spf1 include:spf.brevo.com include:spf.privateemail.com ~all
```

Keep the separate `brevo-code:e3780163856cb1297fb42adc4ea84c19` TXT record as-is —
it is a different record, not part of SPF. DNS lookup cost after the change is 5 of
the permitted 10 (`spf.brevo.com` is 1, all-ip4; `spf.privateemail.com` nests 3).

**2. Turn on DKIM for Private Email.** Namecheap → Private Email → the rotahr.com
domain → enable DKIM, then add the TXT record it gives you (host is normally
`default._domainkey`). Confirm it resolves before step 3.

## Then flip DMARC

Change the `_dmarc` TXT record to:

```
v=DMARC1; p=quarantine; sp=quarantine; adkim=r; aspf=r; pct=100; rua=mailto:gnemeth1984@gmail.com
```

`pct=100` only after a week of clean aggregate reports; start at `pct=25` if you
would rather ramp. Relaxed alignment (`adkim=r`) is what lets Resend's
`send.rotahr.com` bounce domain pass.

## Verify

```bash
curl -s "https://dns.google/resolve?name=_dmarc.rotahr.com&type=TXT"
curl -s "https://dns.google/resolve?name=default._domainkey.rotahr.com&type=TXT"
curl -s "https://api.brevo.com/v3/senders/domains/rotahr.com" -H "api-key: $BREVO_API_KEY"
```

A Vercel API token cannot do any of this unless it is **account-scoped**: the
project-scoped token in `.env.local` gets `forbidden` from
`/v4/domains/rotahr.com/records` and `/v5/domains`.
