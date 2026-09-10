"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import { createStudentAction, updateStudentAction, type StudentFormState } from "@/app/(app)/students/actions";
import { studentStatusLabels } from "@/lib/students";

type StudentDefaults = {
  id: string; fullName: string; phone: string; university: string; admissionNumber: string;
  nationalId: string; admittedAt: string; status: "ACTIVE" | "CHECKED_OUT" | "SUSPENDED" | "ARCHIVED";
  notes: string; guardianName: string; guardianPhone: string; guardianRelationship: string; guardianEmail: string;
};

const initialState: StudentFormState = { error: "" };

export function StudentForm({ student }: { student?: StudentDefaults }) {
  const action = student ? updateStudentAction.bind(null, student.id) : createStudentAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="panel entity-form">
      <div className="form-section-heading"><div><p className="panel-kicker">Student details</p><h2>{student ? `Edit ${student.fullName}` : "Register a student"}</h2></div><p>Fields marked with * are required.</p></div>
      <div className="form-grid">
        <label className="field-group form-span-2"><span>Full name *</span><input defaultValue={student?.fullName} maxLength={120} name="fullName" placeholder="Student’s full name" required /></label>
        <label className="field-group"><span>Phone number *</span><input defaultValue={student?.phone} inputMode="tel" name="phone" placeholder="e.g. 0712 345 678" required /></label>
        <label className="field-group"><span>Admission number</span><input defaultValue={student?.admissionNumber} maxLength={50} name="admissionNumber" placeholder="JKUAT admission number" /></label>
        <label className="field-group"><span>University *</span><input defaultValue={student?.university ?? "JKUAT"} maxLength={100} name="university" required /></label>
        <label className="field-group"><span>National ID</span><input defaultValue={student?.nationalId} maxLength={30} name="nationalId" placeholder="Optional" /></label>
        <label className="field-group"><span>Date admitted *</span><input defaultValue={student?.admittedAt ?? today} name="admittedAt" required type="date" /></label>
        <label className="field-group"><span>Student status *</span><select defaultValue={student?.status ?? "ACTIVE"} name="status">{(["ACTIVE", "CHECKED_OUT", "SUSPENDED", "ARCHIVED"] as const).map((status) => <option key={status} value={status}>{studentStatusLabels[status]}</option>)}</select></label>
      </div>

      <div className="form-divider"><p className="panel-kicker">Parent or guardian</p><h3>Emergency contact</h3></div>
      <div className="form-grid">
        <label className="field-group"><span>Guardian name *</span><input defaultValue={student?.guardianName} maxLength={120} name="guardianName" required /></label>
        <label className="field-group"><span>Guardian phone *</span><input defaultValue={student?.guardianPhone} inputMode="tel" name="guardianPhone" placeholder="e.g. 0712 345 678" required /></label>
        <label className="field-group"><span>Relationship</span><input defaultValue={student?.guardianRelationship} maxLength={50} name="guardianRelationship" placeholder="e.g. Mother, Father" /></label>
        <label className="field-group"><span>Guardian email</span><input defaultValue={student?.guardianEmail} name="guardianEmail" placeholder="Optional" type="email" /></label>
        <label className="field-group form-span-2"><span>Notes</span><textarea defaultValue={student?.notes} maxLength={500} name="notes" placeholder="Optional student, medical or administrative notes" rows={4} /></label>
      </div>

      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      <div className="form-actions"><Link className="secondary-button no-underline" href="/students"><ArrowLeft size={17} /> Cancel</Link><button className="primary-button" disabled={pending} type="submit">{pending ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={17} />}{student ? "Save changes" : "Add student"}</button></div>
    </form>
  );
}
