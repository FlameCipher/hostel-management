import currencies from "./currencies.json";
export type CurrencyCode = keyof typeof currencies;
export const currencyOptions = Object.entries(currencies).map(([code, value]) => ({ code, ...value }));
export function validCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && Object.hasOwn(currencies, value);
}
export function currencyDigits(currency: string) {
  if (!validCurrency(currency)) throw Error("Unsupported currency");
  return currencies[currency].digits;
}
export const currencyStep = (currency: string) => 10 ** -currencyDigits(currency);
export function minorUnits(value: number, currency: string) {
  const scaled = value * 10 ** currencyDigits(currency);
  if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(scaled)) || Math.abs(scaled - Math.round(scaled)) > 0.00001) throw Error("INVALID_CURRENCY_AMOUNT");
  return Math.round(scaled);
}
export function validAmount(value: number, currency: string) {
  try { minorUnits(value, currency); return roundCurrency(value, currency) === value; } catch { return false; }
}
export function roundCurrency(value: number, currency: string) {
  const digits = currencyDigits(currency);
  const [coefficient, exponent = "0"] = Math.abs(value).toString().split("e");
  const shifted = Number(`${coefficient}e${Number(exponent) + digits}`);
  return Math.sign(value) * Number(`${Math.round(shifted)}e-${digits}`);
}
export function formatMoney(value: number, currency: string) {
  const digits = currencyDigits(currency);
  return `${currency} ${value.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
