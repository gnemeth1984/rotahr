/**
 * Currency formatting helpers.
 * All app pages should import from here — never hardcode € or £ or $.
 */

export type Currency = "EUR" | "GBP" | "USD" | "CAD" | "AUD";

const SYMBOLS: Record<Currency, string> = {
  EUR: "€",
  GBP: "£",
  USD: "$",
  CAD: "C$",
  AUD: "A$",
};

const LOCALES: Record<Currency, string> = {
  EUR: "en-IE",
  GBP: "en-GB",
  USD: "en-US",
  CAD: "en-CA",
  AUD: "en-AU",
};

// Sales tax / VAT — these vary a lot outside the EU/UK, so treat non-EUR/GBP
// values as a sensible default only. Always show a "varies by state/province"
// note in the UI wherever this is used for anything beyond a rough estimate.
const TAX_RATES: Record<Currency, number> = {
  EUR: 23, // Irish VAT
  GBP: 20, // UK VAT
  USD: 0,  // No federal sales tax — varies by state (0-10%+), merchant of record handles collection
  CAD: 5,  // Federal GST baseline — provinces add PST/HST on top (varies 5-15% combined)
  AUD: 10, // Australian GST — flat national rate
};

const NMW_LABELS: Record<Currency, string> = {
  EUR: "Irish NMW is €13.50/hr from 1 January 2025 (National Minimum Wage Act 2000 as amended).",
  GBP: "UK NLW is £11.44/hr (National Living Wage, April 2024).",
  USD: "US federal minimum wage is $7.25/hr, but most states and cities set a higher rate — always check your local rate.",
  CAD: "Canadian minimum wage is set provincially (ranges roughly CA$15-19/hr) — check your province's current rate.",
  AUD: "Australian National Minimum Wage is A$24.10/hr (July 2024) under the Fair Work Act 2009.",
};

const TAX_LABELS: Record<Currency, string> = {
  EUR: "VAT",
  GBP: "VAT",
  USD: "Sales Tax",
  CAD: "GST/HST",
  AUD: "GST",
};

export function getCurrencySymbol(currency: Currency | string): string {
  return SYMBOLS[currency as Currency] ?? "€";
}

export function getLocale(currency: Currency | string): string {
  return LOCALES[currency as Currency] ?? "en-IE";
}

export function getVatRate(currency: Currency | string): number {
  return TAX_RATES[currency as Currency] ?? 23;
}

export function getTaxLabel(currency: Currency | string): string {
  return TAX_LABELS[currency as Currency] ?? "VAT";
}

export function getNMWLabel(currency: Currency | string): string {
  return NMW_LABELS[currency as Currency] ?? NMW_LABELS.EUR;
}

/**
 * Format a number as a currency string, e.g. €1,234.56, £1,234.56, $1,234.56
 */
export function formatMoney(
  amount: number,
  currency: Currency | string = "EUR"
): string {
  const symbol = getCurrencySymbol(currency);
  const locale = getLocale(currency);
  return `${symbol}${amount.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format a date using the correct locale for the business.
 */
export function formatDate(
  date: Date | string,
  currency: Currency | string = "EUR",
  opts?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(getLocale(currency), opts);
}

export function formatTime(
  date: Date | string,
  currency: Currency | string = "EUR",
  opts?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString(getLocale(currency), opts);
}

// Maps a currency to a sensible default business country code (ISO 3166-1 alpha-2)
export function getDefaultCountry(currency: Currency | string): string {
  switch (currency) {
    case "GBP": return "GB";
    case "USD": return "US";
    case "CAD": return "CA";
    case "AUD": return "AU";
    default: return "IE";
  }
}

// ── Working-time / overtime compliance rules ────────────────────────────────
// Deliberately simplified defaults, not full legal advice — always show the
// caveat in the UI. Real rules vary by state/province/sector; these are
// sane national baselines so the warning is at least relevant to the region.
export interface WorkingTimeRule {
  weeklyThresholdHours: number;
  label: string; // short name of the rule, shown in the warning banner
  caveat: string; // one-line disclaimer shown under the warning
}

const WORKING_TIME_RULES: Record<Currency, WorkingTimeRule> = {
  EUR: {
    weeklyThresholdHours: 48,
    label: "EU Working Time Directive",
    caveat: "Weekly hours capped at 48h (averaged) under the EU Working Time Directive — worth reviewing before publishing.",
  },
  GBP: {
    weeklyThresholdHours: 48,
    label: "UK Working Time Regulations",
    caveat: "Weekly hours capped at 48h (averaged over 17 weeks) under the UK Working Time Regulations 1998, unless the employee has opted out in writing.",
  },
  USD: {
    weeklyThresholdHours: 40,
    label: "US FLSA overtime threshold",
    caveat: "No federal cap on hours, but hours over 40/week trigger overtime pay (1.5x) under the Fair Labor Standards Act — some states (e.g. California) also require daily overtime over 8h/day.",
  },
  CAD: {
    weeklyThresholdHours: 48,
    label: "Canadian federal overtime baseline",
    caveat: "48h/week is a common provincial default before overtime rules kick in, but exact thresholds vary by province — check your province's employment standards.",
  },
  AUD: {
    weeklyThresholdHours: 38,
    label: "Fair Work Act ordinary hours",
    caveat: "38 ordinary hours/week under the Fair Work Act 2009, plus \"reasonable\" additional hours — anything well above 38h is worth a second look.",
  },
};

export function getWorkingTimeRule(currency: Currency | string): WorkingTimeRule {
  return WORKING_TIME_RULES[currency as Currency] ?? WORKING_TIME_RULES.EUR;
}
