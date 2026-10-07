"use client";
import { useActionState } from "react";
import { signTermsAction } from "./actions";
export function TermsSignForm({ name, version, occupancyId, documentHash }: { name: string; version: string; occupancyId: string; documentHash: string }) {
  const [state, action, pending] = useActionState(signTermsAction, {});
  if (state.id) return <section className="panel"><p role="status">Your accommodation and hostel terms are accepted and saved.</p><a className="primary-button" href={`/tenant/terms/${state.id}/pdf`}>Download accepted terms (PDF)</a></section>;
  return <form action={action} className="panel entity-form">
    <input type="hidden" name="version" value={version} /><input type="hidden" name="occupancyId" value={occupancyId} /><input type="hidden" name="documentHash" value={documentHash} />
    <p>You are accepting accommodation as <strong>{name}</strong>. By pressing the button below, you agree to all the hostel terms displayed above. Your acceptance date and the exact terms are saved digitally.</p>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    <button className="primary-button" disabled={pending} name="agree" value="yes">{pending ? "Saving acceptance…" : "Accept accommodation and agree to hostel terms"}</button>
  </form>;
}
