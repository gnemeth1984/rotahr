# POS Integration Build

## Scope
- Lightspeed K-Series (OAuth 2.0) — most common in Irish restaurants
- Square (OAuth 2.0) — most common small venues
- Read-only: daily revenue, hourly breakdown, top items, transaction count
- Labour % = today's labour cost (from shifts) / today's revenue (from POS)
- GDPR compliant: only aggregate stats stored, tokens encrypted, audit log

## Steps
- [x] Schema: PosConnection model + PosSnapshot model
- [ ] Migrate DB
- [ ] Env vars needed: LIGHTSPEED_CLIENT_ID, LIGHTSPEED_CLIENT_SECRET, SQUARE_APP_ID, SQUARE_APP_SECRET, POS_TOKEN_SECRET (for AES encryption)
- [ ] API: /api/pos/connect/[provider] — start OAuth
- [ ] API: /api/pos/callback/[provider] — handle OAuth callback, save encrypted token
- [ ] API: /api/pos/status — GET current connection status
- [ ] API: /api/pos/disconnect — DELETE connection
- [ ] API: /api/pos/sync — POST trigger manual sync (also runs on cron)
- [ ] API: /api/pos/snapshot — GET today's snapshot for dashboard
- [ ] Cron: daily sync at 23:00 + hourly during trading hours
- [ ] UI: Settings > POS Integration page
- [ ] UI: Dashboard widget — revenue vs labour cost %
- [ ] Compliance: data minimisation, token encryption, GDPR notice on connect page

## Compliance Notes
- GDPR lawful basis: Art.6(1)(b) — performance of contract
- Only store: daily totals, hourly buckets, top 10 items by name+count — NO customer PII
- Tokens encrypted at rest using AES-256-GCM with POS_TOKEN_SECRET
- Tokens never logged
- User can disconnect at any time — all POS data deleted immediately
- Privacy policy must mention POS data processing
