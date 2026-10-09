"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { KeyRound, Mail } from "lucide-react";
import { updateAccountAction } from "@/app/(app)/account/actions";
import { PasswordInput } from "@/components/password-input";
import styles from "./account-security.module.css";

export function AccountSecurityForm({ operation, shared }: { operation: "email" | "password"; shared: boolean }) {
  const [state, action, pending] = useActionState(updateAccountAction, { error: "" });
  const [currentPassword, setCurrentPassword] = useState("");
  const [replacement, setReplacement] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [confirmedSignOut, setConfirmedSignOut] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const id = useId();
  const isEmail = operation === "email";
  const Icon = isEmail ? Mail : KeyRound;

  // Preserve entries after a rejected action and focus its explanation.
  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state]);

  // Successful updates redirect to sign-in; rejected updates must not reset the form.
  return <form action={action} onReset={event => event.preventDefault()} className={styles.card} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={pending}>
    <header className={styles.cardHeading}>
      <span className={styles.icon}><Icon size={21} aria-hidden="true"/></span>
      <div>
        <h2 id={`${id}-title`}>{isEmail ? "Change login email" : "Change hostel password"}</h2>
        <p id={`${id}-description`}>{isEmail ? "Use an email you can access for sign-in and account recovery." : "Choose a unique password to protect your hostel account."}</p>
      </div>
    </header>
    <input type="hidden" name="operation" value={operation}/>
    <div className={styles.fields}>
      <div className={styles.field}>
        <label htmlFor={`${id}-current`}>{shared ? "Current SYSTEM IN ONE password" : "Current hostel password"}</label>
        <PasswordInput id={`${id}-current`} className={styles.input} name="currentPassword" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)}/>
      </div>
      {isEmail ? <>
        <div className={styles.field}>
          <label htmlFor={`${id}-new`}>New login email</label>
          <input id={`${id}-new`} className={styles.input} name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={replacement} onChange={event => setReplacement(event.target.value)}/>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-confirm`}>Confirm new login email</label>
          <input id={`${id}-confirm`} className={styles.input} name="confirmEmail" type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={254} value={confirmation} onChange={event => setConfirmation(event.target.value)}/>
        </div>
      </> : <>
        <div className={styles.field}>
          <label htmlFor={`${id}-new`}>New hostel password</label>
          <PasswordInput id={`${id}-new`} className={styles.input} name="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby={`${id}-password-help`} value={replacement} onChange={event => setReplacement(event.target.value)}/>
          <p id={`${id}-password-help`} className={styles.help}>Use at least 12 characters, such as a unique phrase. Spaces and password managers are supported.</p>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-confirm`}>Confirm new hostel password</label>
          <PasswordInput id={`${id}-confirm`} className={styles.input} name="confirmPassword" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)}/>
        </div>
      </>}
    </div>
    <div className={styles.actions}>
      <label className={styles.confirmation}>
        <input type="checkbox" name="confirmSignOut" required checked={confirmedSignOut} onChange={event => setConfirmedSignOut(event.target.checked)}/>
        <span>I understand I will be signed out of this hostel on all devices, including this one.</span>
      </label>
      {state.error && <p ref={errorRef} className={styles.error} role="alert" tabIndex={-1}>{state.error}</p>}
      <button className={styles.submit} type="submit" disabled={pending}>{pending ? "Updating…" : isEmail ? "Update email and sign out" : "Update password and sign out"}</button>
    </div>
  </form>;
}
