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
