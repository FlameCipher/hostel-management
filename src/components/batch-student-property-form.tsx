"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, PackageCheck, Save } from "lucide-react";
import { createBatchPropertyAction, type BatchPropertyState } from "@/app/(app)/student-property/new/actions";
import { FormSelect } from "@/components/form-select";

const initialState: BatchPropertyState = { error: "" };
const commonItems = [
  ["phone", "Mobile phone"], ["laptop", "Laptop"], ["tablet", "Tablet"],
  ["television", "Television"], ["speaker", "Speaker"], ["iron", "Electric iron"],
  ["cooker", "Electric cooker"], ["suitcase", "Suitcase"], ["mattress", "Mattress"],
  ["bicycle", "Bicycle"],
] as const;

export function BatchStudentPropertyForm({
  occupancies,
  selectedOccupancyId,
}: {
  occupancies: { id: string; label: string }[];
  selectedOccupancyId?: string;
}) {
  const [state, action, pending] = useActionState(createBatchPropertyAction, initialState);
  return <form action={action} className="panel entity-form">
    <div className="form-section-heading"><div><p className="panel-kicker">Student belongings</p><h2>Record items together</h2></div><p>Select every item the student brought. You can add anything missing from the list.</p></div>
    <div className="form-grid">
      <label className="field-group form-span-2"><span>Student and room *</span><FormSelect defaultValue={selectedOccupancyId ?? ""} name="occupancyId" required><option value="">Select active student</option>{occupancies.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</FormSelect></label>
      <fieldset className="property-picker form-span-2"><legend>Common items *</legend><div className="property-option-grid">{commonItems.map(([value, label]) => <label className="property-option" key={value}><input name="commonItems" type="checkbox" value={value} /><PackageCheck size={18} /><span>{label}</span></label>)}</div></fieldset>
      <label className="field-group form-span-2"><span>Other items</span><textarea name="otherItems" placeholder="Enter other items, separated by commas or one per line" rows={3} /><small>Example: Kettle, guitar, printer</small></label>
      <label className="field-group"><span>Condition at check-in *</span><FormSelect defaultValue="GOOD" name="condition" required><option value="NEW">New</option><option value="GOOD">Good</option><option value="FAIR">Fair</option><option value="DAMAGED">Damaged</option><option value="NOT_APPLICABLE">Not applicable</option></FormSelect></label>
      <label className="field-group"><span>General notes</span><textarea maxLength={500} name="notes" placeholder="Optional note applying to these items" rows={3} /></label>
    </div>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    <div className="form-actions"><Link className="secondary-button no-underline" href="/student-property"><ArrowLeft size={17} /> Cancel</Link><button className="primary-button" disabled={pending} type="submit"><Save size={17} /> {pending ? "Saving…" : "Save selected items"}</button></div>
  </form>;
}
