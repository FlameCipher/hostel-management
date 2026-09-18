"use client";

import { FormSelect } from "@/components/form-select";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import { checkoutStudentAction, type StayFormState } from "@/app/(app)/occupancy/stay-actions";

const initialState: StayFormState = { error: "" };
type Item = { id: string; name: string; checkInCondition?: string; quantity?: number };
type Stay = { startDate: string; endDate: string | null; semesterRate: number };
const conditions = ["NEW", "GOOD", "FAIR", "DAMAGED", "MISSING", "NOT_APPLICABLE"];

export function CheckoutInspectionForm({ occupancyId, allowOverride, propertyItems, assets, semesterStart, semesterEnd, currentRent, rentPaid, stays }: { occupancyId: string; allowOverride: boolean; propertyItems: Item[]; assets: Item[]; semesterStart: string; semesterEnd: string; currentRent: number; rentPaid: number; stays: Stay[] }) {
  const [state, action, pending] = useActionState(checkoutStudentAction.bind(null, occupancyId), initialState);
  const today = new Date().toISOString().slice(0, 10);
  const [checkoutDate, setCheckoutDate] = useState(today);
  const [rentMethod, setRentMethod] = useState("KEEP_FULL");
  const [customRent, setCustomRent] = useState("");
  const preview = useMemo(() => {
    if (rentMethod === "KEEP_FULL") return currentRent;
    if (rentMethod === "CUSTOM") return customRent === "" ? null : Number(customRent);
    const day = (value: string) => Date.parse(`${value.slice(0, 10)}T00:00:00.000Z`);
    const days = (start: string, end: string) => Math.max(0, Math.round((day(end) - day(start)) / 86_400_000));
    const semesterEndExclusive = new Date(day(semesterEnd) + 86_400_000).toISOString().slice(0, 10);
    const checkoutEndExclusive = new Date(day(checkoutDate) + 86_400_000).toISOString().slice(0, 10);
    const totalDays = Math.max(1, days(semesterStart, semesterEndExclusive));
    const amount = stays.reduce((sum, stay) => {
      const recordedEnd = stay.endDate?.slice(0, 10);
      const end = recordedEnd && recordedEnd < checkoutEndExclusive ? recordedEnd : checkoutEndExclusive;
      return sum + stay.semesterRate * days(stay.startDate.slice(0, 10), end) / totalDays;
    }, 0);
    return Math.round(amount * 100) / 100;
  }, [checkoutDate, currentRent, customRent, rentMethod, semesterEnd, semesterStart, stays]);
  const credit = preview === null ? 0 : Math.max(0, rentPaid - preview);
  return <form action={action} className="panel entity-form"><div className="form-section-heading"><div><p className="panel-kicker">Final clearance</p><h2>Checkout inspection and rent review</h2></div><p>Review the financial effect before completing clearance. Existing payment receipts remain unchanged.</p></div><div className="form-grid"><label className="field-group"><span>Checkout date *</span><input defaultValue={today} max={semesterEnd} min={semesterStart} name="checkedOutAt" onChange={(event) => setCheckoutDate(event.target.value)} type="date" required /></label><label className="field-group"><span>Rent treatment *</span><FormSelect name="rentMethod" onChange={(event) => setRentMethod(event.target.value)} value={rentMethod}><option value="KEEP_FULL">Keep current semester rent</option><option value="ACTUAL_DAYS">Pro-rate using actual days</option>{allowOverride ? <option value="CUSTOM">Custom agreed semester rent</option> : null}</FormSelect></label>{rentMethod === "CUSTOM" ? <label className="field-group"><span>Final agreed rent (KES) *</span><input min="0" name="customRent" onChange={(event) => setCustomRent(event.target.value)} step="0.01" type="number" value={customRent} required /></label> : <input name="customRent" type="hidden" value="" />}{rentMethod !== "KEEP_FULL" ? <label className="field-group form-span-2"><span>Rent recalculation reason *</span><textarea minLength={5} name="rentAdjustmentReason" rows={3} required /></label> : <input name="rentAdjustmentReason" type="hidden" value="" />}<div className="calculation-preview form-span-2"><span>Current rent</span><strong>KES {currentRent.toLocaleString("en-KE")}</strong><span>Proposed final rent</span><strong>{preview === null || Number.isNaN(preview) ? "Enter the agreed rent" : `KES ${preview.toLocaleString("en-KE")}`}</strong><span>Rent already paid</span><strong>KES {rentPaid.toLocaleString("en-KE")}</strong>{credit > 0 ? <small>Student credit after checkout: KES {credit.toLocaleString("en-KE")}</small> : null}</div><label className="field-group form-span-2"><span>Overall room condition *</span><textarea minLength={3} name="checkoutCondition" rows={4} required /></label></div>{propertyItems.length ? <InspectionSection title="Student property" items={propertyItems} prefix="propertyCondition" /> : null}{assets.length ? <InspectionSection title="Hostel items in room" items={assets} prefix="assetCondition" /> : null}{allowOverride ? <div className="form-grid inspection-section"><label className="check-field form-span-2"><input name="overrideBalance" type="checkbox" /><span>Owner/Admin override: clear even if a balance remains</span></label><label className="field-group form-span-2"><span>Balance override reason</span><textarea minLength={8} name="overrideReason" rows={3} /></label></div> : null}{state.error ? <p className="form-error">{state.error}</p> : null}<div className="form-actions"><Link className="secondary-button no-underline" href={`/occupancy/${occupancyId}`}><ArrowLeft size={17} /> Cancel</Link><button className="primary-button" disabled={pending}><LogOut size={17} /> Complete checkout</button></div></form>;
}

function InspectionSection({ title, items, prefix }: { title: string; items: Item[]; prefix: string }) {
  return <section className="inspection-section"><div className="form-divider"><p className="panel-kicker">Condition check</p><h3>{title}</h3></div><div className="inspection-list">{items.map((item) => <label className="inspection-row" key={item.id}><span><strong>{item.name}</strong><small>{item.quantity ? `Quantity ${item.quantity}` : `Check-in: ${item.checkInCondition}`}</small></span><FormSelect name={`${prefix}:${item.id}`} required><option value="">Select condition</option>{conditions.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</FormSelect></label>)}</div></section>;
}
