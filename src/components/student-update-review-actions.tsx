"use client";

import { useActionState, useState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import { approveStudentUpdateAction, rejectStudentUpdateAction, type UpdateReviewState } from "@/app/(app)/students/update-requests/actions";

const initial: UpdateReviewState = { error: "", success: "" };

export function StudentUpdateReviewActions({ requestId }: { requestId: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [approveState, approveAction, approving] = useActionState(approveStudentUpdateAction.bind(null, requestId), initial);
  const [rejectState, rejectAction, rejectingPending] = useActionState(rejectStudentUpdateAction.bind(null, requestId), initial);
  const message = approveState.error || approveState.success || rejectState.error || rejectState.success;
  return <div className="update-review-actions">
    {!rejecting ? <div className="row-actions"><form action={approveAction}><button className="primary-button compact-button" disabled={approving} type="submit">{approving ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />} Approve</button></form><button className="secondary-button compact-button reject-outline" onClick={() => setRejecting(true)} type="button"><X size={16} /> Reject</button></div> : <form action={rejectAction} className="reject-update-form"><label className="field-group"><span>Reason for rejection *</span><textarea autoFocus maxLength={300} name="reviewNotes" placeholder="Explain what the student should correct" required rows={2} /></label><div className="row-actions"><button className="secondary-button compact-button" onClick={() => setRejecting(false)} type="button">Cancel</button><button className="danger-button compact-button" disabled={rejectingPending} type="submit">{rejectingPending ? <LoaderCircle className="animate-spin" size={16} /> : <X size={16} />} Confirm rejection</button></div></form>}
    {message ? <p className={approveState.success || rejectState.success ? "review-success" : "review-error"} role="status">{message}</p> : null}
  </div>;
}
