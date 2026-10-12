"use client";

import {useActionState} from "react";
import {ClipboardCheck, LoaderCircle} from "lucide-react";
import {
  submitTransferEvidenceAction,type TransferEvidenceState,
} from "@/app/(app)/occupancy/[id]/transfer-review/actions";

const initialState:TransferEvidenceState={error:"",success:""};

export function TransferEvidenceForm({
  occupancyId,fingerprint,requestId,
}: {occupancyId:string;fingerprint:string;requestId:string}) {
  const [state,action,pending]=useActionState(
    submitTransferEvidenceAction.bind(null,occupancyId),initialState,
  );
  return <form action={action} className="panel entity-form">
    <div className="form-section-heading">
      <div><p className="panel-kicker">Owner &amp; Admin only</p>
        <h2>Record a transfer investigation note</h2></div>
      <ClipboardCheck size={20}/>
    </div>
    <p className="muted-note">
      This adds a dated audit note to the student’s transfer history. It does not
      verify an alleged physical move date, replace existing evidence, or
      change financial charges, room allocation, saved stay dates, or receipts.
      Reference a source such as a signed move-in form, security log or tenancy
      communication; no source document is uploaded from this form.
    </p>
    <input type="hidden" name="fingerprint" value={fingerprint}/>
    <input type="hidden" name="requestId" value={requestId}/>
    <div className="form-grid">
      <label className="field-group">
        <span>Review category *</span>
        <select name="noteType" required defaultValue="REPORTED_DISCREPANCY">
          <option value="REPORTED_DISCREPANCY">Reported difference requiring evidence</option>
          <option value="REVIEW_OBSERVATION">Management observation</option>
          <option value="EVIDENCE_REFERENCE">Source document reference (not verified)</option>
        </select>
      </label>
      <label className="field-group">
        <span>Claimed physical transfer date (optional)</span>
        <input type="date" name="reportedPhysicalMoveDate"/>
        <small>Only if reported; this will not alter the recorded system date.</small>
      </label>
      <label className="field-group form-span-2">
        <span>Reference for supporting information (optional)</span>
        <input name="evidenceReference" maxLength={180}
          placeholder="e.g. signed transfer form dated 11 Oct, caretaker log page 4"/>
      </label>
      <label className="field-group form-span-2">
        <span>Owner or manager observation *</span>
        <textarea name="note" rows={4} minLength={20} maxLength={1200} required
          placeholder="Clearly distinguish what the student or owner reported, from what a dated, independent record verifies."/>
      </label>
      <label className="check-field form-span-2">
        <input type="checkbox" name="acknowledged" required/>
        <span>I understand this creates only an unverified case note. Financial and occupancy records remain unchanged.</span>
      </label>
    </div>
    {state.error?<p className="form-error" role="alert">{state.error}</p>:null}
    {state.success?<p className="review-success" role="status">{state.success} Refresh to record another observation.</p>:null}
    <div className="form-actions">
      <button className="primary-button" type="submit" disabled={pending||Boolean(state.success)}>
        {pending?<LoaderCircle size={17} className="animate-spin"/>:<ClipboardCheck size={17}/>}
        {pending?"Saving reviewed note…":"Record audit note"}
      </button>
    </div>
  </form>;
}
