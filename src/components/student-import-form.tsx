"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, FileUp, LoaderCircle } from "lucide-react";
import { importStudentsAction, type StudentImportState } from "@/app/(app)/students/import/actions";

const initial: StudentImportState = { error: "", message: "", details: [] };
export function StudentImportForm() {
  const [state, action, pending] = useActionState(importStudentsAction, initial);
  return <form action={action} className="panel entity-form"><div className="form-section-heading"><div><p className="panel-kicker">Bulk onboarding</p><h2>Import student register</h2><p>Upload up to 500 records. Existing admission numbers or phone numbers are skipped.</p></div></div><div className="form-grid"><label className="field-group form-span-2"><span>Student CSV *</span><input accept=".csv,text/csv" name="students" type="file" required /><small>Room allocation is optional. If provided, the importer checks semester status and room capacity and creates the rent charge.</small></label></div>{state.error ? <p className="form-error" role="alert">{state.error}</p> : null}{state.message ? <div className="import-result"><strong>{state.message}</strong>{state.details.length ? <ul>{state.details.map((detail, index) => <li key={`${detail}-${index}`}>{detail}</li>)}</ul> : null}</div> : null}<div className="form-actions"><Link className="secondary-button no-underline" href="/students"><ArrowLeft size={17} /> Students</Link><a className="secondary-button no-underline" href="/students/import/template">Download template</a><button className="primary-button" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" size={17} /> : <FileUp size={17} />} Import students</button></div></form>;
}
