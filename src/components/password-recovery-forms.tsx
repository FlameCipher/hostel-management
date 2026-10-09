"use client";
import styles from "./password-recovery.module.css";
import { useActionState, useState } from "react";
import Link from "next/link";
import { PasswordInput } from "@/components/password-input";
import { requestRecoveryAction } from "@/app/forgot-password/actions";
import { resetRecoveryAction } from "@/app/reset-password/[token]/actions";
import type { RecoveryKind, RecoveryState } from "@/lib/password-recovery";
const initial: RecoveryState = { error: "", message: "" };
export function RecoveryRequestForm({ kind, shared }: { kind: RecoveryKind; shared: boolean }) {
  const [state, action, pending] = useActionState(requestRecoveryAction, initial);
  return <form action={action} className={`panel ${styles.form}`}><input type="hidden" name="kind" value={kind}/>{shared && <label className="field-group"><span>Hostel website address *</span><input name="hostel" placeholder="mmambugua.studentshostels.com" autoComplete="url" maxLength={300} required/><small>Use your hostel’s short name or full StudentsHostels address.</small></label>}<label className="field-group"><span>{kind === "TENANT" ? "Registered email or mobile number" : "Registered login email"} *</span><input name="identifier" type={kind === "MANAGEMENT" ? "email" : "text"} autoComplete="username" required maxLength={254}/></label><p>We send the link to the email already on your account. A mobile number identifies a tenant account; it does not send an SMS or WhatsApp message.</p>{state.error && <p className="form-error" role="alert">{state.error}</p>}{state.message && <p role="status">{state.message}</p>}<button className="primary-button" disabled={pending}>{pending ? "Requesting reset…" : "Request reset link"}</button></form>;
}
export function RecoveryResetForm({ token, tenant }: { token: string; tenant: boolean }) {
  const [state, action, pending] = useActionState(resetRecoveryAction, initial);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  if (state.complete) return <section className={`panel ${styles.form}`}><p role="status">{state.message}</p><Link className="primary-button" href={tenant ? "/tenant/login" : "/login"}>Sign in with new password</Link></section>;
  return <form action={action} className={`panel ${styles.form}`}><input type="hidden" name="token" value={token}/><label className="field-group"><span>New password *</span><PasswordInput value={password} onChange={event => setPassword(event.target.value)} name="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><label className="field-group"><span>Confirm new password *</span><PasswordInput value={confirmation} onChange={event => setConfirmation(event.target.value)} name="confirmation" autoComplete="new-password" minLength={12} maxLength={128} required/></label>{state.error && <p className="form-error" role="alert">{state.error}</p>}<button className="primary-button" disabled={pending}>{pending ? "Resetting password…" : "Reset password"}</button></form>;
}
