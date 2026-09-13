"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { deleteStudentAction, type DeleteStudentState } from "@/app/(app)/students/actions";

const initialState: DeleteStudentState = { error: "" };

export function DeleteStudentForm({ studentId, studentName, canDelete }: { studentId: string; studentName: string; canDelete: boolean }) {
  const [state, action, pending] = useActionState(deleteStudentAction.bind(null, studentId), initialState);
  return <form action={action} className="panel entity-form">
    <div className="form-section-heading"><div><p className="panel-kicker">Permanent deletion</p><h2>Delete {studentName}</h2><p>Use this only for an unused duplicate or a record entered by mistake.</p></div></div>
    <div className="warning-callout"><Trash2 size={18} /><div><strong>{canDelete ? "This action cannot be undone." : "This student cannot be deleted."}</strong><p>{canDelete ? "The unused student record, guardian details, and unpaid intake charge will be removed." : "The record has operational or financial history. Archive it from the edit page instead."}</p></div></div>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    <div className="form-actions"><Link className="secondary-button no-underline" href="/students">Cancel</Link>{canDelete ? <button className="danger-button" disabled={pending} type="submit">{pending ? <LoaderCircle className="animate-spin" size={17} /> : <Trash2 size={17} />} Delete student permanently</button> : null}</div>
  </form>;
}
