"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, CalendarPlus, LoaderCircle } from "lucide-react";
import { createSemesterAction, type SemesterFormState } from "@/app/(app)/semesters/actions";

const initialState: SemesterFormState = { error: "" };
export function SemesterForm() {
  const [state, action, pending] = useActionState(createSemesterAction, initialState);
  return <form action={action} className="panel entity-form"><div className="form-section-heading"><div><p className="panel-kicker">Academic period</p><h2>Create semester</h2></div></div><div className="form-grid"><label className="field-group form-span-2"><span>Semester name *</span><input name="name" placeholder="e.g. January–April 2027" required /></label><label className="field-group"><span>Start date *</span><input name="startDate" type="date" required /></label><label className="field-group"><span>End date *</span><input name="endDate" type="date" required /></label><label className="field-group"><span>Payable months *</span><input defaultValue="4" max="12" min="1" name="months" type="number" required /></label></div>{state.error ? <p className="form-error" role="alert">{state.error}</p> : null}<div className="form-actions"><Link className="secondary-button no-underline" href="/semesters"><ArrowLeft size={17} /> Cancel</Link><button className="primary-button" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" size={17} /> : <CalendarPlus size={17} />} Create semester</button></div></form>;
}
