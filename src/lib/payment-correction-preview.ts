import { minorUnits, validAmount } from "@/lib/currency";

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
  const divisor=10**({KES:2,USD:2,JPY:0}[currency as "KES"|"USD"|"JPY"]??2);
  // For supported multi-currency hosts, use the same ledger scale.
  const precision=10**(String(minorUnits(1,currency)).length-1);
  void divisor;void precision;
  return {
    paidAfter: newPaid/(minorUnits(1,currency)),
    balanceAfter: (rent-newPaid)/(minorUnits(1,currency)),
    change: (next-old)/(minorUnits(1,currency)),
  };
}
