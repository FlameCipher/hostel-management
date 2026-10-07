"use client";
import { useActionState } from "react";
import { tenantLoginAction, type TenantLoginState } from "./actions";
const initial: TenantLoginState = { error: "" };
export function TenantLoginForm() {
  const [state, action, pending] = useActionState(tenantLoginAction, initial);
  return <form action={action} className="panel entity-form">
    <label className="field-group"><span>Mobile number or email *</span><input autoComplete="username" name="email" type="text" required /></label>
    <label className="field-group"><span>Password *</span><input autoComplete="current-password" minLength={8} name="password" type="password" required /></label>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    <button className="primary-button" disabled={pending}>{pending ? "Signing in…" : "Student sign in"}</button>
  </form>;
}
