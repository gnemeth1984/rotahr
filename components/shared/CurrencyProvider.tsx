"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Currency, formatMoney, getCurrencySymbol, getVatRate, getLocale, getNMWLabel, getTaxLabel } from "@/lib/currency";

interface CurrencyContextType {
  currency: Currency;
  symbol: string;
  vatRate: number;
  taxLabel: string;
  locale: string;
  fmt: (n: number) => string;
  nmwLabel: string;
  ready: boolean;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "EUR",
  symbol: "€",
  vatRate: 23,
  taxLabel: "VAT",
  locale: "en-IE",
  fmt: (n) => `€${n.toFixed(2)}`,
  nmwLabel: "Irish NMW is €13.50/hr from 1 January 2025 (National Minimum Wage Act 2000 as amended).",
  ready: false,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/business/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.currency) setCurrency(data.currency as Currency);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  const value: CurrencyContextType = {
    currency,
    symbol: getCurrencySymbol(currency),
    vatRate: getVatRate(currency),
    taxLabel: getTaxLabel(currency),
    locale: getLocale(currency),
    fmt: (n) => formatMoney(n, currency),
    nmwLabel: getNMWLabel(currency),
    ready,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
