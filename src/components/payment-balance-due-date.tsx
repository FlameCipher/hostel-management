import { formatMoney } from "@/lib/currency";
import { paymentEntryBalance } from "@/lib/payment-entry-balance";

export function PaymentBalanceDueDate({ balance, amount, currency }: {
  balance: number | undefined; amount: string; currency: string;
}) {
  const remaining = paymentEntryBalance(balance, amount, currency);
  if (remaining === null) return null;
  if (remaining === 0) return <p className="field-group" role="status">This payment clears the selected balance. No next balance due date is needed.</p>;
  return <label className="field-group"><span>Next balance due date (optional)</span>
    <input name="nextBalanceDueDate" type="date" />
    <small>Remaining after this payment: {formatMoney(remaining, currency)}.</small>
  </label>;
}
