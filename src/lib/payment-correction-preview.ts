import { minorUnits, validAmount, currencyDigits } from "@/lib/currency";

/** Preview only: a correction replaces a posting, never records additional cash. */
export function paymentAmountCorrectionPreview(input: {
  currency: string;
  chargeAmount: number;
  existingActivePaid: number;
  oldPaymentAmount: number;
  replacementAmount: number;
}) {
  const {currency,chargeAmount,existingActivePaid,oldPaymentAmount,replacementAmount}=input;
  if(!validAmount(chargeAmount,currency) || !validAmount(existingActivePaid,currency) ||
     !validAmount(oldPaymentAmount,currency) || !validAmount(replacementAmount,currency) ||
     oldPaymentAmount<=0 || replacementAmount<=0) throw Error("INVALID_AMOUNT");
  const old=minorUnits(oldPaymentAmount,currency), next=minorUnits(replacementAmount,currency);
  const current=minorUnits(existingActivePaid,currency), rent=minorUnits(chargeAmount,currency);
  if(old>current)throw Error("INCONSISTENT_LEDGER");
  if(replacementAmount===oldPaymentAmount)throw Error("UNCHANGED_AMOUNT");
  const newPaid=current-old+next;
  if(newPaid<0 || newPaid>rent)throw Error("REPLACEMENT_EXCEEDS_CHARGE");
  const divisor = 10 ** currencyDigits(currency);
  return {
    paidAfter: newPaid/divisor,
    balanceAfter: (rent-newPaid)/divisor,
    change: (next-old)/divisor,
  };
}
