"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldAlert } from "lucide-react";
import {
  emptyGuardianCleanupState, normalizeExistingGuardianPhonesAction,
} from "@/app/(app)/students/guardians/actions";

export function GuardianNormalizationApproval({
  count,fingerprint,
}: {count:number;fingerprint:string}) {
  const [state,formAction,pending] = useActionState(
    normalizeExistingGuardianPhonesAction, emptyGuardianCleanupState,
  );
  const [phrase,setPhrase] = useState("");
  const [approved,setApproved] = useState(false);
  const canSubmit = !pending && approved && phrase === "NORMALIZE GUARDIAN CONTACTS";
  return <form action={formAction} className="panel entity-form" aria-label="Guardian phone cleanup approval">
    <div className="form-section-heading">
      <div><p className="panel-kicker">Owner or Admin approval</p>
        <h2>Standardize existing Kenyan guardian numbers</h2></div>
      <ShieldAlert size={23}/>
    </div>
    <p>This is one audited operation for <strong>{count} eligible contacts</strong>. It changes only phone formatting
      from a verified Kenyan local mobile number to its corresponding international 254 number.
      Guardian identities, numbers themselves, student records, bills and receipts are not changed.
      No SMS, WhatsApp or email is sent.</p>
    <input type="hidden" name="expectedCount" value={count}/>
    <input type="hidden" name="fingerprint" value={fingerprint}/>
    <div className="form-grid">
      <label className="field-group form-span-2">
        <span>Enter <strong>NORMALIZE GUARDIAN CONTACTS</strong> to confirm</span>
        <input name="approvalPhrase" value={phrase}
          autoComplete="off" spellCheck={false}
          onChange={e=>setPhrase(e.target.value)}
          placeholder="NORMALIZE GUARDIAN CONTACTS"
          maxLength={48} required/>
      </label>
      <label className="field-group form-span-2">
        <span className="check-field">
          <input name="confirm" type="checkbox" checked={approved}
            onChange={e=>setApproved(e.target.checked)}/>
          <span>I have reviewed the proposed contacts and authorize the formatting-only correction.</span>
        </span>
      </label>
    </div>
    {state.error ? <p className="form-error" role="alert">{state.error}</p>:null}
    {state.success ? <p className="review-success" role="status"><CheckCircle2 size={17}/> {state.success}</p>:null}
    <div className="form-actions">
      <button className="primary-button" type="submit" disabled={!canSubmit}>
        {pending?<LoaderCircle size={17} className="animate-spin"/>:<CheckCircle2 size={17}/>}
        {pending?"Saving audited changes…":`Approve ${count} format corrections`}
      </button>
    </div>
  </form>;
}
