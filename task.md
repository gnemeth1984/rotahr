# US/UK/Canada/Australia Expansion Task

## Done
- lib/currency.ts: added USD, CAD, AUD (symbols, locales, tax rates, NMW labels, tax labels)
- CurrencyProvider: added taxLabel to context
- Settings > General: currency selector now dropdown w/ 5 currencies + country mapping
- Bookkeeping page: dynamic taxLabel for summary cards, table headers, CSV export, VAT summary note; compliance banner shows generic disclaimer for non-EUR/GBP currencies instead of fabricating foreign legal citations

## Remaining
- [ ] Bookkeeping: form Label "VAT (€)" -> dynamic; Supplier VAT No. section -> dynamic/conditional
- [ ] tsc build check
- [ ] Terms & Privacy: add multi-jurisdiction clauses (US CCPA/CPRA mention, Canada PIPEDA, Australia Privacy Act 1988, independent contractor classification disclaimer for affiliates) + legal review disclaimer
- [ ] Partner/affiliate page copy: mention global (US/UK/CA/AU/IE)
- [ ] Job ads: US, UK, Canada, Australia versions (base off existing IE one at /home/user/rotahr-hiring/indeed-job-ad.md)
- [ ] Where-to-find-affiliates list per country
- [ ] Build + deploy
- [ ] Final honest summary: what's covered vs what needs real legal review (Lemon Squeezy = MoR handles tax collection globally, contractor classification needs lawyer eyes especially US)
