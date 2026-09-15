"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, LoaderCircle, Search, Send } from "lucide-react";
import { identifyStudentAction, submitStudentDetailsAction, type StudentDetailsSubmissionState, type StudentLookupState } from "@/app/update-details/actions";

const lookupInitial: StudentLookupState = { error: "" };
const submissionInitial: StudentDetailsSubmissionState = { error: "" };

export function StudentLookupForm() {
  const [state, action, pending] = useActionState(identifyStudentAction, lookupInitial);
  return <form action={action} className="public-update-form">
    <label className="field-group"><span>Full name *</span><input autoComplete="name" maxLength={120} name="fullName" placeholder="As registered with the hostel" required /></label>
    <label className="field-group"><span>Registered phone number *</span><input autoComplete="tel" inputMode="tel" name="phone" placeholder="e.g. 0712 345 678" required /></label>
    {state.error ? <p className="form-error public-form-error" role="alert">{state.error}</p> : null}
    <button className="primary-button public-update-submit" disabled={pending} type="submit">{pending ? <LoaderCircle className="animate-spin" size={18} /> : <Search size={18} />}{pending ? "Checking…" : "Continue securely"}</button>
  </form>;
}

export function StudentDetailsUpdateForm({
  missing,
}: {
  missing: { email: boolean; admissionNumber: boolean; nationalId: boolean };
}) {
  const [state, action, pending] = useActionState(submitStudentDetailsAction, submissionInitial);
  return <form action={action} className="public-update-form">
    {missing.email || missing.admissionNumber || missing.nationalId ? <div className="public-form-section"><p className="panel-kicker">Missing student details</p><h2>Complete your record</h2></div> : null}
    {missing.email ? <label className="field-group"><span>Student email *</span><input autoComplete="email" name="email" placeholder="name@example.com" required type="email" /></label> : null}
    {missing.admissionNumber ? <label className="field-group"><span>Admission number *</span><input autoCapitalize="characters" maxLength={50} name="admissionNumber" required /></label> : null}
    {missing.nationalId ? <label className="field-group"><span>National ID or identification number *</span><input autoCapitalize="characters" maxLength={30} name="nationalId" required /></label> : null}

    <div className="public-form-section"><p className="panel-kicker">Emergency contact</p><h2>Guardian details</h2><p>Guardian name, relationship and phone are required for every submission.</p></div>
    <label className="field-group"><span>Guardian full name *</span><input autoComplete="name" maxLength={120} name="guardianName" required /></label>
    <label className="field-group"><span>Relationship *</span><input maxLength={50} name="guardianRelationship" placeholder="e.g. Mother, Father, Aunt" required /></label>
    <label className="field-group"><span>Guardian phone number *</span><input autoComplete="tel" inputMode="tel" name="guardianPhone" placeholder="e.g. 0712 345 678" required /></label>
    <label className="field-group"><span>Guardian email</span><input autoComplete="email" name="guardianEmail" placeholder="Optional" type="email" /></label>
    <label className="public-consent"><input name="consent" required type="checkbox" /><span>I confirm that these details are accurate and may be used by the hostel for administration and emergency communication.</span></label>
    {state.error ? <p className="form-error public-form-error" role="alert">{state.error}</p> : null}
    <div className="public-update-actions"><Link className="secondary-button no-underline" href="/update-details"><ArrowLeft size={17} /> Start again</Link><button className="primary-button" disabled={pending} type="submit">{pending ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}{pending ? "Submitting…" : "Submit for review"}</button></div>
  </form>;
}
