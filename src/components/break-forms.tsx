"use client";

import { FormSelect } from "@/components/form-select";
import { useActionState, useMemo, useState } from "react";
import { CalendarPlus, Save } from "lucide-react";
import { createBreakPeriodAction, saveBreakDecisionAction, type BreakFormState } from "@/app/(app)/occupancy/actions";

const initialState: BreakFormState = { error: "" };

export function BreakPeriodForm({ defaultMonths }: { defaultMonths: number }) {
  const [state, action, pending] = useActionState(createBreakPeriodAction, initialState);
  const [mode, setMode] = useState("MONTHLY_RATE_MONTHS");
  return <form action={action} className="mini-form"><div className="form-grid"><label className="field-group form-span-2"><span>Break name *</span><input name="name" placeholder="e.g. January–March 2027 Break" required /></label><label className="field-group"><span>Start date *</span><input name="startDate" type="date" required /></label><label className="field-group"><span>End date *</span><input name="endDate" type="date" required /></label><label className="field-group"><span>Billable months *</span><input defaultValue={defaultMonths} min="1" max="12" name="months" type="number" required /></label><label className="field-group"><span>Storage pricing *</span><FormSelect name="storageChargeMode" onChange={(event) => setMode(event.target.value)} value={mode}><option value="MONTHLY_RATE_MONTHS">Monthly room rate × months</option><option value="FLAT_AMOUNT">Flat storage amount</option><option value="PERCENTAGE_MONTHLY_RATE">Percentage of monthly rate × months</option></FormSelect></label>{mode !== "MONTHLY_RATE_MONTHS" ? <label className="field-group form-span-2"><span>{mode === "FLAT_AMOUNT" ? "Flat amount (KES) *" : "Percentage of monthly rate *"}</span><input min="0" name="storageChargeValue" step="0.01" type="number" required /></label> : <input name="storageChargeValue" type="hidden" value="" />}</div><p className="policy-note">This becomes the default belongings-storage charge. Owner/Admin may approve a different amount for an individual student.</p>{state.error ? <p className="form-error" role="alert">{state.error}</p> : null}<button className="primary-button mini-submit" disabled={pending}><CalendarPlus size={17} /> Create break period</button></form>;
}

type Period = { id: string; label: string; months: number; storageChargeMode: "MONTHLY_RATE_MONTHS" | "FLAT_AMOUNT" | "PERCENTAGE_MONTHLY_RATE"; storageChargeValue: number | null };
type OccupancyOption = { id: string; label: string; monthlyRate: number };

export function BreakDecisionForm({ periods, occupancies, allowCustom }: { periods: Period[]; occupancies: OccupancyOption[]; allowCustom: boolean }) {
  const [state, action, pending] = useActionState(saveBreakDecisionAction, initialState);
  const [periodId, setPeriodId] = useState("");
  const [occupancyId, setOccupancyId] = useState("");
  const [intent, setIntent] = useState("RETURNING");
  const [belongingsStored, setBelongingsStored] = useState(false);
  const [customCharge, setCustomCharge] = useState("");
  const calculated = useMemo(() => {
    if (!belongingsStored || intent !== "RETURNING") return 0;
    const period = periods.find((item) => item.id === periodId);
    const occupancy = occupancies.find((item) => item.id === occupancyId);
    if (!period || !occupancy) return null;
    if (period.storageChargeMode === "FLAT_AMOUNT") return period.storageChargeValue ?? 0;
    if (period.storageChargeMode === "PERCENTAGE_MONTHLY_RATE") return Math.round((occupancy.monthlyRate * period.months * (period.storageChargeValue ?? 100) / 100) * 100) / 100;
    return occupancy.monthlyRate * period.months;
  }, [belongingsStored, intent, occupancies, occupancyId, periodId, periods]);
  const finalCharge = customCharge === "" ? calculated : Number(customCharge);
  const overridden = calculated !== null && customCharge !== "" && Math.abs(Number(customCharge) - calculated) >= 0.005;
  return <form action={action} className="mini-form"><div className="form-grid"><label className="field-group"><span>Break period *</span><FormSelect name="breakPeriodId" onChange={(event) => setPeriodId(event.target.value)} required value={periodId}><option value="">Select period</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</FormSelect></label><label className="field-group"><span>Student and current room *</span><FormSelect name="occupancyId" onChange={(event) => setOccupancyId(event.target.value)} required value={occupancyId}><option value="">Select student</option>{occupancies.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</FormSelect></label><label className="field-group"><span>Intention *</span><FormSelect name="intent" onChange={(event) => setIntent(event.target.value)} value={intent} required><option value="RETURNING">Returning next semester</option><option value="NOT_RETURNING">Not returning</option></FormSelect></label><label className="check-field"><input checked={belongingsStored} name="belongingsStored" onChange={(event) => setBelongingsStored(event.target.checked)} type="checkbox" /><span>Belongings remain in the room</span></label>{belongingsStored && intent === "RETURNING" ? <><div className="calculation-preview form-span-2"><span>Calculated storage charge</span><strong>{calculated === null ? "Select break and student" : `KES ${calculated.toLocaleString("en-KE")}`}</strong><span>Final storage charge</span><strong>{finalCharge === null || Number.isNaN(finalCharge) ? "—" : `KES ${finalCharge.toLocaleString("en-KE")}`}</strong></div>{allowCustom ? <label className="field-group"><span>Custom final charge (optional)</span><input min="0" name="customStorageCharge" onChange={(event) => setCustomCharge(event.target.value)} placeholder="Use calculated amount" step="0.01" type="number" value={customCharge} /></label> : <input name="customStorageCharge" type="hidden" value="" />}{overridden ? <label className="field-group form-span-2"><span>Override reason *</span><textarea minLength={5} name="chargeOverrideReason" rows={2} required /></label> : <input name="chargeOverrideReason" type="hidden" value="" />}</> : <><input name="customStorageCharge" type="hidden" value="" /><input name="chargeOverrideReason" type="hidden" value="" /></>}<label className="field-group form-span-2"><span>Notes</span><textarea maxLength={500} name="notes" rows={3} /></label></div><p className="policy-note">Returning without belongings reserves the room free. Returning with belongings uses the break period’s configured storage charge. Students not returning must complete checkout.</p>{state.error ? <p className="form-error" role="alert">{state.error}</p> : null}<button className="primary-button mini-submit" disabled={pending}><Save size={17} /> Save decision</button></form>;
}
