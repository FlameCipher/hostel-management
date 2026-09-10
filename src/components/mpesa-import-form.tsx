"use client";

import { useActionState } from "react";
import { FileUp, LoaderCircle } from "lucide-react";
import { importMpesaStatementAction, type ImportState } from "@/app/(app)/payments/reconciliation/actions";

const initialState: ImportState = { error: "", message: "" };

export function MpesaImportForm() {
  const [state, action, pending] = useActionState(importMpesaStatementAction, initialState);
  return <form action={action} className="panel entity-form">
    <div className="form-section-heading"><div><p className="panel-kicker">Statement import</p><h2>Upload M-Pesa CSV</h2><p>Required columns: transactionCode, amount, transactedAt. Phone and reference are optional.</p></div></div>
    <div className="form-grid"><label className="field-group form-span-2"><span>CSV statement *</span><input accept=".csv,text/csv" name="statement" type="file" required /></label></div>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}{state.message ? <p className="form-success" role="status">{state.message}</p> : null}
    <div className="form-actions"><a className="secondary-button no-underline" href="/payments/reconciliation/template">Download template</a><button className="primary-button" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" size={17} /> : <FileUp size={17} />} Import statement</button></div>
  </form>;
}
