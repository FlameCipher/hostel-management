"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ReceiptText } from "lucide-react";
import { formatMoney, currencyStep } from "@/lib/currency";
import { paymentAmountCorrectionPreview } from "@/lib/payment-correction-preview";
import {
  correctPaymentAmountAction, type PaymentAmountCorrectionState,
} from "@/app/(app)/payments/[id]/correct/actions";

const initial: PaymentAmountCorrectionState={error:""};

export function PaymentAmountCorrectionForm(props: {
  paymentId:string; receiptNumber:string; studentName:string; roomLabel:string;
  currency:string; oldAmount:number; activePaid:number; chargeAmount:number;
  studentHasEmail:boolean;
}) {
  const {paymentId,receiptNumber,studentName,roomLabel,currency,oldAmount,activePaid,chargeAmount,studentHasEmail}=props;
  const [state,action,pending]=useActionState(correctPaymentAmountAction.bind(null,paymentId),initial);
  const [amount,setAmount]=useState(String(oldAmount));
  const [acknowledged,setAcknowledged]=useState(false);
  const preview=useMemo(()=>{
    const n=Number(amount);
    if(!amount.trim() || !Number.isFinite(n))return null;
    try{return paymentAmountCorrectionPreview({
      currency,chargeAmount,existingActivePaid:activePaid,
      oldPaymentAmount:oldAmount,replacementAmount:n,
    });}catch{return null;}
  },[currency,amount,chargeAmount,activePaid,oldAmount]);
  const money=(value:number)=>formatMoney(value,currency);
  return <form action={action} className="panel entity-form">
    <div className="form-section-heading">
      <div><p className="panel-kicker">Audited finance correction</p><h2>Replace incorrect receipt amount</h2></div>
      <p>Existing funds only. This action does not request an M-Pesa reversal or collect another payment.</p>
    </div>
    <div className="form-grid">
      <div className="form-span-2">
        <p><strong>{studentName}</strong> · {roomLabel}</p>
        <p className="muted-note">Original receipt {receiptNumber} · {money(oldAmount)}</p>
      </div>
      <label className="field-group"><span>Recorded amount</span><input readOnly value={money(oldAmount)}/></label>
      <label className="field-group"><span>Correct amount actually received ({currency}) *</span>
        <input name="correctedAmount" type="number" step={currencyStep(currency)} min={currencyStep(currency)}
          value={amount} onChange={(event)=>setAmount(event.target.value)} required/>
      </label>
      <input type="hidden" name="originalAmount" value={oldAmount}/>
      <input type="hidden" name="currency" value={currency}/>
      <label className="field-group form-span-2"><span>Reason for the incorrect posting *</span>
        <textarea name="reason" rows={3} minLength={12} maxLength={350}
          placeholder="Example: Original amount was keyed as KES 9,500; owner verified the actual M-Pesa receipt was KES 9,000." required/>
      </label>
      <div className="calculation-preview form-span-2">
        <span>Semester or charge total</span><strong>{money(chargeAmount)}</strong>
        <span>Current active payments</span><strong>{money(activePaid)}</strong>
        <span>Corrected active payments</span><strong>{preview?money(preview.paidAfter):"Enter a valid different amount"}</strong>
        <span>Corrected outstanding balance</span><strong>{preview?money(preview.balanceAfter):"Not available"}</strong>
      </div>
      <div className="form-span-2 warning-callout"><AlertTriangle size={21}/>
        <div><strong>Original receipt remains permanently in the audit trail.</strong>
          <p>It will be marked as internally reversed. A new numbered, verifiable receipt will replace it, linked to the same existing payment reference and current student charge.</p>
        </div>
      </div>
      <label className="field-group form-span-2"><span className="check-field">
        <input type="checkbox" name="acknowledge" checked={acknowledged} onChange={(event)=>setAcknowledged(event.target.checked)} required/>
        <span>I confirm the actual amount received and authorize an internal correction; no cash is being refunded or newly collected.</span>
      </span></label>
      {studentHasEmail?<label className="field-group form-span-2"><span className="check-field">
        <input type="checkbox" name="emailReplacement" defaultChecked/>
        <span>Email the new PDF receipt to the student's saved address after correction.</span>
      </span></label>:<p className="muted-note form-span-2">No student email is recorded. Share the new receipt from the receipt page after saving.</p>}
    </div>
    {state.error?<p role="alert" className="form-error">{state.error}</p>:null}
    <div className="form-actions">
      <Link className="secondary-button no-underline" href={`/payments/${paymentId}/receipt`}><ArrowLeft size={17}/> Cancel</Link>
      <button className="primary-button" disabled={pending||!acknowledged||!preview} type="submit"><ReceiptText size={17}/> {pending?"Saving audited correction…":"Confirm correction and issue new receipt"}</button>
    </div>
  </form>;
}
