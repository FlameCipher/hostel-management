"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { createPropertyAction, updatePropertyAction, type PropertyFormState } from "@/app/(app)/student-property/actions";

const initialState: PropertyFormState = { error: "" };
type Option = { id: string; label: string };
type Defaults = { id: string; occupancyId: string; name: string; category: string; description: string; checkInCondition: string; checkoutCondition: string; notes: string };
const categories = ["LAPTOP", "SUITCASE", "MATTRESS", "ELECTRONICS", "BICYCLE", "OTHER"];
const conditions = ["NEW", "GOOD", "FAIR", "DAMAGED", "MISSING", "NOT_APPLICABLE"];

export function PropertyForm({ occupancies, item, selectedOccupancyId }: { occupancies: Option[]; item?: Defaults; selectedOccupancyId?: string }) {
  const action = item ? updatePropertyAction.bind(null, item.id) : createPropertyAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} className="panel entity-form">
    <div className="form-section-heading"><div><p className="panel-kicker">Student valuables</p><h2>{item ? "Edit property item" : "Add property item"}</h2></div></div>
    <div className="form-grid">
      <label className="field-group form-span-2"><span>Student and room *</span><select defaultValue={item?.occupancyId ?? selectedOccupancyId ?? ""} name="occupancyId" required><option value="">Select active occupancy</option>{occupancies.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label className="field-group"><span>Item name *</span><input defaultValue={item?.name} name="name" required /></label>
      <label className="field-group"><span>Category *</span><select defaultValue={item?.category ?? "OTHER"} name="category">{categories.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      <label className="field-group"><span>Check-in condition *</span><select defaultValue={item?.checkInCondition ?? "GOOD"} name="checkInCondition">{conditions.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      <label className="field-group"><span>Checkout condition</span><select defaultValue={item?.checkoutCondition ?? ""} name="checkoutCondition"><option value="">Not checked out</option>{conditions.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      <label className="field-group form-span-2"><span>Description</span><input defaultValue={item?.description} name="description" /></label>
      <label className="field-group form-span-2"><span>Notes</span><textarea defaultValue={item?.notes} name="notes" rows={3} /></label>
    </div>
    {state.error ? <p className="form-error">{state.error}</p> : null}
    <div className="form-actions"><Link className="secondary-button no-underline" href="/student-property"><ArrowLeft size={17} /> Cancel</Link><button className="primary-button" disabled={pending}><Save size={17} /> Save property</button></div>
  </form>;
}
