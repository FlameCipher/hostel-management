"use client";
import Link from "next/link";
import { PasswordInput } from "@/components/password-input";
import { HostelInstallCard } from "./hostel-app";
import { useActionState, useRef, useState, type FormEvent } from "react";
import { registerTenantAction, reviewRegistrationAction } from "@/app/tenant/register/actions";
import styles from "./resident-services.module.css";
import signup from "./existing-tenant-signup.module.css";

type Step=1|2;

/**
 * This is NOT new student admission. The request is linked only after an
 * existing occupant's registered identity and room are checked by management.
 */
export function TenantRegistrationForm({ ticket, countryCode, hostelName }: { ticket: string; countryCode?:string|null; hostelName:string }) {
  const [state,action,pending]=useActionState(registerTenantAction,{});
  const [step,setStep]=useState<Step>(1);
  const [formError,setFormError]=useState("");
  const form=useRef<HTMLFormElement>(null);
  const localPhone=countryCode==="KE";
  function next(){
    const fields=Array.from(form.current?.querySelectorAll<HTMLInputElement>("[data-identity-input]")??[]);
    const invalid=fields.find(input=>!input.checkValidity());
    if(invalid){invalid.reportValidity();invalid.focus();return;}
    setFormError("");
    setStep(2);
  }
  function guardSubmit(event:FormEvent<HTMLFormElement>) {
    // Mobile Enter/Go must advance the visible first step, never try to submit
    // invisible password inputs or silently create an incomplete request.
    if(step===1){event.preventDefault();next();return;}
    const form=event.currentTarget;
    const password=form.elements.namedItem("password");
    const confirmation=form.elements.namedItem("confirmation");
    if(!(password instanceof HTMLInputElement)||!(confirmation instanceof HTMLInputElement)){
      event.preventDefault();setFormError("Please enter and confirm your password.");return;
    }
    if(password.value!==confirmation.value) {
      event.preventDefault();setFormError("Passwords do not match. Check both entries and try again.");
      confirmation.focus();return;
    }
    if(new TextEncoder().encode(password.value).length>72) {
      event.preventDefault();setFormError("Your password is too long. Use fewer characters.");
      password.focus();return;
    }
    setFormError("");
  }
  if(state.success)return <section className={signup.confirmation} role="status">
    <span className={signup.tag}>Step 2 of 2 complete · Request received</span>
    <h2>Registration request received</h2>
    <p>Management will check your existing hostel record and room before activating your account.</p>
    <p><strong>Creating an account does not book another room or charge you rent.</strong></p>
    <p className={signup.help}>Once management approves your request, sign in using the mobile number and password you chose.</p>
    <Link className="primary-button" href="/tenant/login">Student sign in</Link>
    <details className={signup.install}><summary>Install hostel app on my phone (optional)</summary><HostelInstallCard/></details>
  </section>;
  return <form ref={form} action={action} onSubmit={guardSubmit} className={signup.form}>
    <input name="ticket" type="hidden" value={ticket}/>
    <input name="website" type="hidden" value=""/>
    <div className={signup.steps} aria-label="Registration progress">
      <span className={step===1?signup.current:signup.completed}>1 · My hostel details</span>
      <span className={step===2?signup.current:""}>2 · Set password</span>
    </div>
    <fieldset hidden={step!==1} className={signup.fieldset} aria-label="Verify existing hostel details">
      <legend className={signup.legend}>Confirm your existing hostel details</legend>
      <p className={signup.intro}>Use the same details you gave {hostelName} when you moved in.</p>
      <label className="field-group"><span>Your registered full name *</span>
        <input data-identity-input name="fullName" type="text" autoComplete="name" autoCapitalize="words" minLength={2} maxLength={120}
          placeholder="e.g. Mary Wanjiku" required/>
      </label>
      <label className="field-group"><span>Your registered mobile number *</span>
        <input data-identity-input name="phone" type="tel" inputMode="tel" autoComplete="tel" minLength={8} maxLength={30}
          placeholder={localPhone?"e.g. 0712 345 678":"Include country code, e.g. +254712345678"} required/>
        <small>{localPhone?"Use the number already recorded by hostel management. Kenyan 07, 01 or +254 formats are accepted.":"Use the same mobile number already recorded at your hostel, with country code."}</small>
      </label>
      <label className="field-group"><span>Current room number *</span>
        <input data-identity-input name="roomNumber" type="text" inputMode="text" autoCapitalize="characters" minLength={1}
          maxLength={40} placeholder="e.g. 54" required/>
      </label>
      <button type="button" className="primary-button" onClick={next}>Continue →</button>
      <p className={signup.help}>Already have an active account? <Link href="/tenant/login">Sign in instead</Link>.</p>
    </fieldset>
    <fieldset hidden={step!==2} disabled={step!==2} className={signup.fieldset} aria-label="Create account password">
      <legend className={signup.legend}>Create your sign-in password</legend>
      <p className={signup.intro}>Use a password you can remember and keep private. You will use your mobile number to sign in.</p>
      <label className="field-group"><span>Create password *</span>
        <PasswordInput name="password" autoComplete="new-password" minLength={10} maxLength={128} required/>
        <small>At least 10 characters. You can tap Show to check it.</small>
      </label>
      <label className="field-group"><span>Repeat password *</span>
        <PasswordInput name="confirmation" autoComplete="new-password" minLength={10} maxLength={128} required/>
      </label>
      <label className="check-field"><input type="checkbox" name="consent" required/>
        <span>I live at this hostel and am requesting access to my own student account. Management may verify my details.</span>
      </label>
      <div className={signup.buttons}>
        <button type="button" className="secondary-button" disabled={pending} onClick={()=>{setFormError("");setStep(1);}}>← Edit my details</button>
        <button className="primary-button" type="submit" disabled={pending}>{pending?"Submitting…":"Submit registration"}</button>
      </div>
      <p className={signup.help}>Management will verify your identity and current room before granting access. No extra rent is charged.</p>
    </fieldset>
    {formError?<p className="form-error" role="alert">{formError}</p>:null}
    {state.error?<div className="form-error" role="alert">{state.error}<br/>If you entered a different name, number or room, select <strong>Edit my details</strong>.</div>:null}
  </form>;
}
export function RegistrationReviewForm({ id, candidates, blockApproval=false, blockReason }: { id: string; candidates: Array<{ id: string; label: string }>; blockApproval?: boolean; blockReason?:string }) {
  const [state,action,pending]=useActionState(reviewRegistrationAction,{});
  const single=candidates.length===1;
  return <form action={action}>
    <input type="hidden" name="id" value={id}/>
    {blockReason?<p className={styles.warning} role="status">
      {blockReason} Approval is blocked until the issue is resolved.
      You can reject an invalid request with an explanation.
    </p>:null}
    <label className="field-group"><span>{single?"Existing resident matching this request":"Link to the verified existing resident"}</span>
      <select name="studentId" defaultValue={single?candidates[0].id:""}>
        <option value="">{candidates.length?"Select verified tenant":"No exact record match found"}</option>
        {candidates.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
    </label>
    {single?<p className={styles.meta}>One name, registered mobile and room match was found. Verify the student independently before approval.</p>:null}
    {candidates.length===0?<p className={styles.warning}>This request cannot be activated until management has independently verified and corrected the existing student record.</p>:null}
    <label className="field-group"><span>Independent identity verification method (required to activate)</span>
      <select name="verificationMethod" defaultValue="">
        <option value="">Choose how you verified this resident</option>
        <option value="IN_PERSON">Resident verified in person at the hostel</option>
        <option value="CALL_REGISTERED_PHONE">I called the number already on the hostel register</option>
      </select>
    </label>
    <label className="check-field"><input type="checkbox" name="verified"/>
      <span>I independently verified this tenant using the method selected above, matching the existing registered name, phone and current room. Submitted details alone are not proof of identity.</span>
    </label>
    <label className="field-group"><span>Reason if rejecting *</span>
      <select name="rejectionReason" defaultValue="">
        <option value="">Choose a reason when rejecting</option>
        <option value="NO_MATCH">No eligible existing resident match</option>
        <option value="WRONG_PHONE">Registered phone differs</option>
        <option value="WRONG_ROOM">Current room is different</option>
        <option value="CONFLICTING_REQUEST">Conflicting identity using the same phone</option>
        <option value="DUPLICATE">Repeated or obsolete registration</option>
        <option value="OTHER">Other verified reason</option>
      </select>
    </label>
    <label className="field-group"><span>Management review note (optional)</span>
      <textarea name="reviewNote" rows={2} maxLength={300}
        placeholder="Avoid passwords or full identity document numbers"/>
    </label>
    {state.error?<p role="alert" className="form-error">{state.error}</p>:null}
    {state.success?<p role="status" className="form-success">{state.success}</p>:null}
    <div className={styles.actions}>
      <button className="primary-button" name="decision" value="APPROVE" disabled={pending||!!state.success||candidates.length===0||blockApproval}>Verify & activate account</button>
      <button className="secondary-button" name="decision" value="REJECT" disabled={pending||!!state.success}>Reject with reason</button>
    </div>
  </form>;
}
