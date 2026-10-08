"use client";
import { createContext, useContext } from "react";
const CurrencyContext = createContext<string | null>(null);
export function CurrencyProvider({ currency, children }: { currency: string; children: React.ReactNode }) {
  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}
export function useCurrency() {
  const currency = useContext(CurrencyContext);
  if (!currency) throw Error("Currency context is required");
  return currency;
}
