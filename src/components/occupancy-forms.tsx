"use client";
import { useCurrency } from "@/components/currency-context";
import { formatMoney, currencyStep, roundCurrency } from "@/lib/currency";
import { calculateMonthlyTransferRent } from "@/lib/monthly-transfer-rent";

import { FormSelect } from "@/components/form-select";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { ArrowLeft, ArrowRightLeft, LogIn, LogOut } from "lucide-react";
import { checkInStudentAction, checkoutStudentAction, transferRoomAction, type StayFormState } from "@/app/(app)/occupancy/stay-actions";

import { RoomSelector, type AllocationRoomOption } from "@/components/room-selector";

const initialState: StayFormState = { error: "" };
type Option = { id: string; label: string };

type CheckInFormProps = {
  students: Option[];
  semesters: Option[];
  rooms: AllocationRoomOption[];
  selectedStudent?: Option;
  selectedSemester?: Option;
  paymentId?: string;
  cancelHref?: string;
  semesterStart?: string;
  semesterEnd?: string;
  currentRent?: number;
  allowCustomRent?: boolean;
};

export function CheckInForm({
  students,
  semesters,
  rooms,
  selectedStudent,
  selectedSemester,
  paymentId,
  cancelHref = "/occupancy",
  semesterStart,
  semesterEnd,
  currentRent,
  allowCustomRent = false,
}: CheckInFormProps) {
  const currency = useCurrency();
  const money = (value: number) => formatMoney(value, currency);
  const [state, action, pending] = useActionState(checkInStudentAction, initialState);
  const today = new Date().toISOString().slice(0, 10);
  const initialCheckIn = semesterStart && today < semesterStart ? semesterStart : semesterEnd && today > semesterEnd ? semesterEnd : today;
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [checkInAt, setCheckInAt] = useState(initialCheckIn);
  const [rentMethod, setRentMethod] = useState("KEEP_FULL");
  const [customRent, setCustomRent] = useState("");
  const pricingAvailable = semesterStart !== undefined && semesterEnd !== undefined && currentRent !== undefined;
  const rentPreview = useMemo(() => {
    if (!pricingAvailable) return null;
    if (rentMethod === "KEEP_FULL") return currentRent;
    if (rentMethod === "CUSTOM") return customRent === "" ? null : Number(customRent);
    const room = rooms.find((item) => item.id === selectedRoomId);
    if (!room || !checkInAt) return null;
    const day = (value: string) => Date.parse(`${value}T00:00:00.000Z`);
    const totalDays = Math.max(1, Math.round((day(semesterEnd) - day(semesterStart)) / 86_400_000) + 1);
    const occupiedDays = Math.max(0, Math.round((day(semesterEnd) - day(checkInAt)) / 86_400_000) + 1);
    return roundCurrency(room.rate * occupiedDays / totalDays, currency);
  }, [currency, checkInAt, currentRent, customRent, pricingAvailable, rentMethod, rooms, selectedRoomId, semesterEnd, semesterStart]);
  return (
    <form action={action} className="panel entity-form"><input type="hidden" name="currency" value={currency} />
      <div className="form-section-heading">
        <div><p className="panel-kicker">Room allocation</p><h2>Assign room and check in</h2></div>
        <p>An initial payment has been confirmed. Select the specific room number.</p>
      </div>
      <div className="form-grid">
        {paymentId ? <input name="paymentId" type="hidden" value={paymentId} /> : null}
        {selectedStudent ? (
          <label className="field-group">
            <span>Student *</span>
            <input readOnly value={selectedStudent.label} />
            <input name="studentId" type="hidden" value={selectedStudent.id} />
          </label>
        ) : (
          <label className="field-group">
            <span>Student *</span>
            <FormSelect name="studentId" required>
              <option value="">Select student</option>
              {students.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </FormSelect>
          </label>
        )}
        {selectedSemester ? (
          <label className="field-group">
            <span>Active semester *</span>
            <input readOnly value={selectedSemester.label} />
            <input name="semesterId" type="hidden" value={selectedSemester.id} />
          </label>
        ) : (
          <label className="field-group">
            <span>Active semester *</span>
            <FormSelect defaultValue={semesters.length === 1 ? semesters[0].id : ""} name="semesterId" required>
              <option value="">Select semester</option>
              {semesters.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </FormSelect>
          </label>
        )}
        <RoomSelector onValueChange={setSelectedRoomId} rooms={rooms} />
        <label className="field-group"><span>Check-in date *</span><input max={semesterEnd} min={semesterStart} name="checkInAt" onChange={(event) => setCheckInAt(event.target.value)} type="date" value={checkInAt} required /></label>
        <label className="field-group"><span>Rent due date *</span><input defaultValue={today} name="dueDate" type="date" required /></label>
        <label className="field-group"><span>Expected checkout</span><input name="expectedCheckoutAt" type="date" /></label>
        {pricingAvailable ? <><label className="field-group"><span>Rent treatment *</span><FormSelect name="rentMethod" onChange={(event) => setRentMethod(event.target.value)} value={rentMethod}><option value="KEEP_FULL">Keep full semester rent</option><option value="ACTUAL_DAYS">Recalculate from check-in date</option>{allowCustomRent ? <option value="CUSTOM">Custom agreed semester rent</option> : null}</FormSelect></label>{rentMethod === "CUSTOM" ? <label className="field-group"><span>Final agreed rent ({currency}) *</span><input min="0" name="customRent" onChange={(event) => setCustomRent(event.target.value)} step={currencyStep(currency)} type="number" value={customRent} required /></label> : <input name="customRent" type="hidden" value="" />}<div className="calculation-preview form-span-2"><span>Original semester charge</span><strong>{money(currentRent)}</strong><span>Proposed semester rent</span><strong>{rentPreview === null || Number.isNaN(rentPreview) ? "Select a room and check-in date" : `${money(rentPreview)}`}</strong>{rentPreview !== null && !Number.isNaN(rentPreview) ? <small>{rentPreview >= currentRent ? `Additional charge: ${money((rentPreview - currentRent))}` : `Credit: ${money((currentRent - rentPreview))}`}</small> : null}</div>{rentMethod !== "KEEP_FULL" ? <label className="field-group form-span-2"><span>Rent recalculation reason *</span><textarea minLength={5} name="rentAdjustmentReason" placeholder="For example: Student joined after the semester began" rows={3} required /></label> : <input name="rentAdjustmentReason" type="hidden" value="" />}</> : <><input name="rentMethod" type="hidden" value="KEEP_FULL" /><input name="customRent" type="hidden" value="" /><input name="rentAdjustmentReason" type="hidden" value="" /></>}
        <label className="field-group form-span-2"><span>Room condition at check-in</span><textarea maxLength={500} name="checkInCondition" placeholder="Describe the room condition and any existing damage" rows={4} /></label>
      </div>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      <div className="form-actions">
        <Link className="secondary-button no-underline" href={cancelHref}><ArrowLeft size={17} /> Cancel</Link>
        <button className="primary-button" disabled={pending}><LogIn size={17} /> Assign room and complete intake</button>
      </div>
    </form>
  );
}

type TransferRoomOption = Option & { semesterRate: number; monthlyRate: number };
type TransferStay = { roomId: string; startDate: string; endDate: string | null; semesterRate: number; monthlyRate: number };

export function TransferForm({ occupancyId, rooms, semesterStart, semesterEnd, currentRent, stays, allowCustom, monthlyEligible }: { occupancyId: string; rooms: TransferRoomOption[]; semesterStart: string; semesterEnd: string; currentRent: number; stays: TransferStay[]; allowCustom: boolean; monthlyEligible: boolean }) {
  const currency = useCurrency();
  const money = (value: number) => formatMoney(value, currency);
  const [state, action, pending] = useActionState(transferRoomAction.bind(null, occupancyId), initialState);
  const today = new Date().toISOString().slice(0, 10);
  const [targetRoomId, setTargetRoomId] = useState("");
  const [transferDate, setTransferDate] = useState(today);
  const lastDayOfEndMonth = new Date(Date.UTC(Number(semesterEnd.slice(0,4)), Number(semesterEnd.slice(5,7)), 0)).getUTCDate();
  const standardMonths = semesterStart.endsWith("-01") && Number(semesterEnd.slice(8,10)) === lastDayOfEndMonth;
  const [rentMethod, setRentMethod] = useState(standardMonths && monthlyEligible ? "MONTHLY" : "ACTUAL_DAYS");
  const [customRent, setCustomRent] = useState("");
  const monthlyPreview = useMemo(() => {
    if (rentMethod !== "MONTHLY" || !standardMonths || !monthlyEligible || !targetRoomId || !transferDate) return null;
    const target = rooms.find((item) => item.id === targetRoomId);
    if (!target) return null;
    try {
      return calculateMonthlyTransferRent({
        currency, firstMonth: semesterStart.slice(0,7), lastMonth: semesterEnd.slice(0,7),
        stays: [
          ...stays.map((stay) => ({ roomId: stay.roomId, startDate: new Date(stay.startDate), monthlyRate: stay.monthlyRate })),
          { roomId: target.id, startDate: new Date(`${transferDate}T12:00:00.000Z`), monthlyRate: target.monthlyRate },
        ],
      });
    } catch { return null; }
  }, [currency, rentMethod, rooms, semesterStart, semesterEnd, stays, standardMonths, monthlyEligible, targetRoomId, transferDate]);
  const preview = useMemo(() => {
    if (rentMethod === "KEEP_FULL") return currentRent;
    if (rentMethod === "CUSTOM") return customRent === "" ? null : Number(customRent);
    if (rentMethod === "MONTHLY") return monthlyPreview?.total ?? null;
    const target = rooms.find((room) => room.id === targetRoomId);
    if (!target || !transferDate) return null;
    const day = (value: string) => Date.parse(`${value.slice(0, 10)}T00:00:00.000Z`);
    const days = (start: string, end: string) => Math.max(0, Math.round((day(end) - day(start)) / 86_400_000));
    const semesterEndExclusive = new Date(day(semesterEnd) + 86_400_000).toISOString().slice(0, 10);
    const totalDays = Math.max(1, days(semesterStart, semesterEndExclusive));
    let amount = 0;
    for (const stay of stays) {
      const end = stay.endDate?.slice(0, 10) ?? transferDate;
      amount += roundCurrency(stay.semesterRate * days(stay.startDate.slice(0, 10), end) / totalDays, currency);
    }
    amount += roundCurrency(target.semesterRate * days(transferDate, semesterEndExclusive) / totalDays, currency);
    return roundCurrency(amount, currency);
  }, [currency, currentRent, customRent, monthlyPreview, rentMethod, rooms, semesterEnd, semesterStart, stays, targetRoomId, transferDate]);
  return <form action={action} className="panel entity-form"><input type="hidden" name="currency" value={currency} /><div className="form-section-heading"><div><p className="panel-kicker">Internal transfer</p><h2>Move to another room</h2></div><p>Changing to a room with a different rate requires rent recalculation. Keeping the old rent is only allowed when the monthly rates match.</p></div><div className="form-grid"><label className="field-group form-span-2"><span>New room *</span><FormSelect name="targetRoomId" onChange={(event) => setTargetRoomId(event.target.value)} required value={targetRoomId}><option value="">Select available room</option>{rooms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</FormSelect></label><label className="field-group"><span>Transfer date *</span><input max={semesterEnd} min={semesterStart} name="transferDate" onChange={(event) => setTransferDate(event.target.value)} type="date" value={transferDate} required /></label><label className="field-group"><span>Rent treatment *</span><FormSelect name="rentMethod" onChange={(event) => setRentMethod(event.target.value)} value={rentMethod}><option value="KEEP_FULL">Keep current semester rent (only if rates match)</option><option value="MONTHLY" disabled={!monthlyEligible}>Recalculate by calendar month</option><option value="ACTUAL_DAYS">Recalculate using actual days</option>{allowCustom ? <option value="CUSTOM">Custom agreed semester rent</option> : null}</FormSelect></label>{rentMethod === "CUSTOM" ? <label className="field-group"><span>Final agreed rent ({currency}) *</span><input min="0" name="customRent" onChange={(event) => setCustomRent(event.target.value)} step={currencyStep(currency)} type="number" value={customRent} required /></label> : <input name="customRent" type="hidden" value="" />}<div className="calculation-preview form-span-2"><span>Current semester rent</span><strong>{money(currentRent)}</strong><span>Proposed semester rent</span><strong>{preview === null || Number.isNaN(preview) ? rentMethod === "MONTHLY" ? "Select room and valid dates" : "Select the room and date" : `${money(preview)}`}</strong>{preview !== null && !Number.isNaN(preview) ? <small>{preview >= currentRent ? `Additional charge: ${money((preview - currentRent))}` : `Credit: ${money((currentRent - preview))}`}</small> : null}</div>{rentMethod === "MONTHLY" ? <div className="form-span-2">
  {monthlyPreview ? <>
    <p className="muted-note">Billing changes from the transfer month; earlier months keep their saved room rate.</p>
    <div className="table-scroll"><table className="data-table"><thead><tr><th>Month</th><th>Room</th><th>Rent</th></tr></thead><tbody>{monthlyPreview.lines.map((line) => <tr key={line.month}><td>{line.month}</td><td>{rooms.find((room) => room.id === line.roomId)?.label.split(" · ")[0] ?? (stays.find((stay) => stay.roomId === line.roomId) ? "Previous room" : "Room")}</td><td>{money(line.rate)}</td></tr>)}</tbody></table></div>
    <label className="check-field"><input type="checkbox" name="confirmRentAdjustment" required /><span>I have checked the room, monthly rates and total adjustment.</span></label>
    <input type="hidden" name="confirmedRent" value={monthlyPreview.total} />
  </> : <p className="form-error" role="status">Choose an eligible room and transfer date to review the monthly rent before continuing.</p>}
</div> : null}<label className="field-group form-span-2"><span>Transfer and rent-adjustment reason *</span><textarea minLength={5} name="reason" rows={4} required /></label></div>{state.error ? <p className="form-error" role="alert">{state.error}</p> : null}<div className="form-actions"><Link className="secondary-button no-underline" href={`/occupancy/${occupancyId}`}><ArrowLeft size={17} /> Cancel</Link><button className="primary-button" disabled={pending || (rentMethod === "MONTHLY" && !monthlyPreview)}><ArrowRightLeft size={17} /> Transfer and apply rent</button></div></form>;
}

export function CheckoutForm({ occupancyId, allowOverride }: { occupancyId: string; allowOverride: boolean }) {
  const [state, action, pending] = useActionState(checkoutStudentAction.bind(null, occupancyId), initialState);
  const today = new Date().toISOString().slice(0, 10);
  return <form action={action} className="panel entity-form"><div className="form-section-heading"><div><p className="panel-kicker">Final clearance</p><h2>Check out student</h2></div></div><div className="form-grid"><label className="field-group"><span>Checkout date *</span><input defaultValue={today} name="checkedOutAt" type="date" required /></label><label className="field-group form-span-2"><span>Room condition at checkout *</span><textarea minLength={3} name="checkoutCondition" placeholder="Record room condition and damaged or missing items" rows={4} required /></label>{allowOverride ? <><label className="check-field form-span-2"><input name="overrideBalance" type="checkbox" /><span>Owner/Admin override: clear even if a balance remains</span></label><label className="field-group form-span-2"><span>Override reason</span><textarea minLength={8} name="overrideReason" rows={3} /></label></> : null}</div>{state.error ? <p className="form-error" role="alert">{state.error}</p> : null}<div className="form-actions"><Link className="secondary-button no-underline" href={`/occupancy/${occupancyId}`}><ArrowLeft size={17} /> Cancel</Link><button className="primary-button" disabled={pending}><LogOut size={17} /> Complete checkout</button></div></form>;
}
