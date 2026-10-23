import { currencyDigits, minorUnits } from "./currency";

/** Preview only; the payment service rechecks the ledger when saving. */
export function paymentEntryBalance(balance: number | undefined, amount: string, currency: string): number | null {
  if (balance === undefined || !amount.trim()) return null;
  try {
    const outstanding = minorUnits(balance, currency);
    const received = minorUnits(Number(amount), currency);
    if (outstanding <= 0 || received <= 0 || received > outstanding) return null;
    return (outstanding - received) / 10 ** currencyDigits(currency);
  } catch {
    return null;
  }
}
