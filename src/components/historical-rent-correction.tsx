"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { formatMoney } from "@/lib/currency";
import { approveHistoricalRentCorrection, type HistoricalCorrectionState } from "@/app/(app)/occupancy/[id]/monthly-correction/actions";

const initial:HistoricalCorrectionState={error:"",success:""};
export function HistoricalRentCorrection({occupancyId,chargeId,currency,expected,recorded,paid,balance,credit}:{
  occupancyId:string;chargeId:string;currency:string;expected:number;recorded:number;paid:number;balance:number;credit:number;
}){
  const router=useRouter();
  const [state,action,pending]=useActionState(approveHistoricalRentCorrection.bind(null,occupancyId),initial);
  useEffect(()=>{if(state.success)router.refresh();},[state.success,router]);
  return <form action={action} className="panel mt-5" aria-label="Approve historical rent reconciliation">
    <div className="panel-heading"><div><p className="panel-kicker">Owner approval required</p><h2>Correct historical room-transfer balance</h2></div></div>
    <p>Review the rent and payment figures before updating this student's existing charge. Receipts and recorded payments will remain unchanged.</p>
    <dl className="detail-list">
      <div><dt>Recorded rent</dt><dd>{formatMoney(recorded,currency)}</dd></div>
      <div><dt>Calculated rent</dt><dd><strong>{formatMoney(expected,currency)}</strong></dd></div>
      <div><dt>Verified recorded payments</dt><dd>{formatMoney(paid,currency)}</dd></div>
      <div><dt>Expected outstanding balance</dt><dd><strong>{formatMoney(balance,currency)}</strong></dd></div>
      {credit>0?<div><dt>Potential credit</dt><dd>{formatMoney(credit,currency)}</dd></div>:null}
    </dl>
    <input type="hidden" name="chargeId" value={chargeId}/>
    <input type="hidden" name="expectedRent" value={expected}/>
    <input type="hidden" name="recordedRent" value={recorded}/>
    <input type="hidden" name="confirmedPaid" value={paid}/>
    <label className="check-field"><input name="confirmed" type="checkbox" required/><span>I have checked the rental agreement, room history and payment records, and approve this audited correction.</span></label>
    <p className="muted-note">This changes the charge amount only, not receipts or payment history. Any credit remains on the ledger for separate handling.</p>
    {state.error?<p className="form-error" role="alert">{state.error}</p>:null}
    {state.success?<p className="review-success" role="status">{state.success}</p>:null}
    <button className="primary-button" type="submit" disabled={pending}>{pending?"Saving correction…":"Approve and apply correction"}</button>
  </form>;
}
