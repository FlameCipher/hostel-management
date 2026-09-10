"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { reversePaymentAction, type ReversalFormState } from "@/app/(app)/payments/reversal-actions";

const initialState: ReversalFormState = { error: "" };

export function PaymentReversalForm({ paymentId, isMpesa }: { paymentId: string; isMpesa: boolean }) {
  const [state, action, pending] = useActionState(reversePaymentAction, initialState);
  return <form action={action} className="panel entity-form">
    <input name="paymentId" type="hidden" value={paymentId} />
    <div className="form-section-heading"><div><p className="panel-kicker">Finance control</p><h2>Reverse payment</h2><p>The original payment and receipt remain in the audit trail.</p></div></div>
    <div className="form-grid">
      <label className="field-group form-span-2"><span>Reversal type *</span><select defaultValue="INTERNAL_CORRECTION" name="reversalType"><option value="INTERNAL_CORRECTION">Internal correction — money was not sent back</option>{isMpesa ? <option value="MPESA_CONFIRMED">M-Pesa reversal confirmed — provider sent money back</option> : null}</select></label>
      <label className="field-group form-span-2"><span>Reason *</span><textarea minLength={8} maxLength={500} name="reason" placeholder="Explain the duplicate, incorrect student, wrong amount, or confirmed provider reversal." rows={4} required /></label>
    </div>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    <div className="form-actions"><Link className="secondary-button no-underline" href={`/payments/${paymentId}/receipt`}>Cancel</Link><button className="danger-button" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" size={17} /> : <RotateCcw size={17} />} Confirm reversal</button></div>
  </form>;
}
