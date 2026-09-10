"use client";

import { useActionState } from "react";
import { CalendarPlus, Save } from "lucide-react";
import { createBreakPeriodAction, saveBreakDecisionAction, type BreakFormState } from "@/app/(app)/occupancy/actions";

const initialState: BreakFormState = { error: "" };

export function BreakPeriodForm() {
  const [state, action, pending] = useActionState(createBreakPeriodAction, initialState);
  return <form action={action} className="mini-form"><div className="form-grid"><label className="field-group form-span-2"><span>Break name *</span><input name="name" placeholder="e.g. January–March 2027 Break" required /></label><label className="field-group"><span>Start date *</span><input name="startDate" type="date" required /></label><label className="field-group"><span>End date *</span><input name="endDate" type="date" required /></label><label className="field-group"><span>Billable months if forfeited *</span><input defaultValue="3" min="1" max="12" name="months" type="number" required /></label></div>{state.error ? <p className="form-error" role="alert">{state.error}</p> : null}<button className="primary-button mini-submit" disabled={pending}><CalendarPlus size={17} /> Create break period</button></form>;
}

type Option = { id: string; label: string };
export function BreakDecisionForm({ periods, occupancies }: { periods: Option[]; occupancies: Option[] }) {
  const [state, action, pending] = useActionState(saveBreakDecisionAction, initialState);
  return <form action={action} className="mini-form"><div className="form-grid"><label className="field-group"><span>Break period *</span><select name="breakPeriodId" required><option value="">Select period</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="field-group"><span>Student and current room *</span><select name="occupancyId" required><option value="">Select student</option>{occupancies.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="field-group"><span>Intention *</span><select name="intent" required><option value="RETURNING">Returning next semester</option><option value="NOT_RETURNING">Not returning</option></select></label><label className="check-field"><input name="belongingsStored" type="checkbox" /><span>Belongings will remain during the break</span></label><label className="field-group form-span-2"><span>Notes</span><textarea maxLength={500} name="notes" rows={3} /></label></div><p className="policy-note">No fee is created now. If a returning student later moves out, the three-month charge applies only when belongings were stored.</p>{state.error ? <p className="form-error" role="alert">{state.error}</p> : null}<button className="primary-button mini-submit" disabled={pending}><Save size={17} /> Save decision</button></form>;
}
