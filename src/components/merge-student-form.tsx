"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LoaderCircle, Merge } from "lucide-react";
import { mergeStudentAction, type MergeStudentState } from "@/app/(app)/students/actions";
import { FormSelect } from "@/components/form-select";

const initialState: MergeStudentState = { error: "" };
type Candidate = { id: string; label: string };

export function MergeStudentForm({ sourceStudentId, sourceName, candidates }: { sourceStudentId: string; sourceName: string; candidates: Candidate[] }) {
  const [state, action, pending] = useActionState(mergeStudentAction.bind(null, sourceStudentId), initialState);
  return <form action={action} className="panel entity-form">
    <div className="form-section-heading"><div><p className="panel-kicker">Duplicate resolution</p><h2>Merge {sourceName}</h2><p>Choose the correct student record to keep. Receipts and valid financial history will be preserved.</p></div></div>
    <div className="form-grid"><label className="field-group form-span-2"><span>Keep this student record *</span><FormSelect aria-label="Student record to keep" name="targetStudentId" required><option value="">Select the correct record</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</FormSelect><small>Choose the allocated record when one of the options already has a room.</small></label></div>
    <div className="warning-callout"><Merge size={18} /><div><strong>The selected record becomes the permanent student profile.</strong><p>Active and reversed receipts remain available. Equivalent rent charges are consolidated so income and arrears are not counted repeatedly.</p></div></div>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    <div className="form-actions"><Link className="secondary-button no-underline" href="/students">Cancel</Link><button className="primary-button" disabled={pending} type="submit">{pending ? <LoaderCircle className="animate-spin" size={17} /> : <Merge size={17} />} Merge into selected record</button></div>
  </form>;
}
