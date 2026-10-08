// Approved one-time platform setup price: USD 40, selected by the owner after converting KES 5,000.
// Fixed displayed price; do not recalculate an accepted order when exchange rates change.
export const PLATFORM_SETUP_FEE = { currency: "USD", amountMinor: 4000 } as const;
export const RENT_PAYMENT_OPTIONS = [
  { value: "PESAPAL", label: "Pesapal" },
  { value: "MPESA_PAYBILL", label: "M-Pesa Paybill" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "OTHER", label: "Other locally available methods" },
] as const;
export type RentPaymentMethod = typeof RENT_PAYMENT_OPTIONS[number]["value"];
export function rentPaymentLabels(methods: readonly string[] = []) {
  return RENT_PAYMENT_OPTIONS.filter(option => methods.includes(option.value)).map(option => option.label);
}
