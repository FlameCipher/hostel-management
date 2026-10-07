"use client";
import { useActionState } from "react";
import { signTermsAction } from "./actions";
export function TermsSignForm({ name, version, occupancyId, documentHash }: { name: string; version: string; occupancyId: string; documentHash: string }) {
  const [state, action, pending] = useActionState(signTermsAction, {});
  if (state.id) return <section className="panel"><p role="status">Your agreement is signed and saved.</p><a className="primary-button" href={`/tenant/terms/${state.id}/pdf`}>Download signed terms (PDF)</a></section>;
  return <form action={action} className="panel entity-form">
    <input type="hidden" name="version" value={version} /><input type="hidden" name="occupancyId" value={occupancyId} /><input type="hidden" name="documentHash" value={documentHash} />
    <label className="field-group"><span>Type your full name to sign: {name}</span><input name="signatureName" required minLength={2} maxLength={300} autoComplete="name" /></label>
    <label><input type="checkbox" name="agree" value="yes" required /> I have read and agree to the complete terms above. I intend my typed full name to be my electronic signature.</label>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    <button className="primary-button" disabled={pending}>{pending ? "Saving your signature…" : "Agree and sign"}</button>
  </form>;
}
