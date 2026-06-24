/**
 * Currency formatting helpers.
 * All app pages should import from here — never hardcode € or £.
 */

export type Currency = "EUR" | "GBP";

export function getCurrencySymbol(currency: Currency | string): string {
  return currency === "GBP" ? "£" : "€";
}

export function getLocale(currency: Currency | string): string {
  return currency === "GBP" ? "en-GB" : "en-IE";
}

export function getVatRate(currency: Currency | string): number {
  return currency === "GBP" ? 20 : 23;
}

export function getNMWLabel(currency: Currency | string): string {
  return currency === "GBP"
    ? "UK NLW is £11.44/hr (National Living Wage, April 2024)."
    : "Irish NMW is €13.50/hr from 1 January 2025 (National Minimum Wage Act 2000 as amended).";
}

/**
 * Format a number as a currency string, e.g. €1,234.56 or £1,234.56
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
