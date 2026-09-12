"use client";

import { FormSelect } from "@/components/form-select";
import Link from "next/link";
import { useActionState } from "react";
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
};

export function CheckInForm({
  students,
  semesters,
  rooms,
  selectedStudent,
  selectedSemester,
  paymentId,
  cancelHref = "/occupancy",
}: CheckInFormProps) {
  const [state, action, pending] = useActionState(checkInStudentAction, initialState);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="panel entity-form">
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
        <RoomSelector rooms={rooms} />
        <label className="field-group"><span>Check-in date *</span><input defaultValue={today} name="checkInAt" type="date" required /></label>
        <label className="field-group"><span>Rent due date *</span><input defaultValue={today} name="dueDate" type="date" required /></label>
        <label className="field-group"><span>Expected checkout</span><input name="expectedCheckoutAt" type="date" /></label>
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

export function TransferForm({ occupancyId, rooms }: { occupancyId: string; rooms: Option[] }) {
  const [state, action, pending] = useActionState(transferRoomAction.bind(null, occupancyId), initialState);
  return <form action={action} className="panel entity-form"><div className="form-section-heading"><div><p className="panel-kicker">Internal transfer</p><h2>Move to another room</h2></div></div><div className="form-grid"><label className="field-group form-span-2"><span>New room *</span><FormSelect name="targetRoomId" required><option value="">Select available room</option>{rooms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</FormSelect></label><label className="field-group form-span-2"><span>Transfer reason *</span><textarea minLength={5} name="reason" rows={4} required /></label></div>{state.error ? <p className="form-error" role="alert">{state.error}</p> : null}<div className="form-actions"><Link className="secondary-button no-underline" href={`/occupancy/${occupancyId}`}><ArrowLeft size={17} /> Cancel</Link><button className="primary-button" disabled={pending}><ArrowRightLeft size={17} /> Transfer room</button></div></form>;
}

export function CheckoutForm({ occupancyId, allowOverride }: { occupancyId: string; allowOverride: boolean }) {
  const [state, action, pending] = useActionState(checkoutStudentAction.bind(null, occupancyId), initialState);
  const today = new Date().toISOString().slice(0, 10);
  return <form action={action} className="panel entity-form"><div className="form-section-heading"><div><p className="panel-kicker">Final clearance</p><h2>Check out student</h2></div></div><div className="form-grid"><label className="field-group"><span>Checkout date *</span><input defaultValue={today} name="checkedOutAt" type="date" required /></label><label className="field-group form-span-2"><span>Room condition at checkout *</span><textarea minLength={3} name="checkoutCondition" placeholder="Record room condition and damaged or missing items" rows={4} required /></label>{allowOverride ? <><label className="check-field form-span-2"><input name="overrideBalance" type="checkbox" /><span>Owner/Admin override: clear even if a balance remains</span></label><label className="field-group form-span-2"><span>Override reason</span><textarea minLength={8} name="overrideReason" rows={3} /></label></> : null}</div>{state.error ? <p className="form-error" role="alert">{state.error}</p> : null}<div className="form-actions"><Link className="secondary-button no-underline" href={`/occupancy/${occupancyId}`}><ArrowLeft size={17} /> Cancel</Link><button className="primary-button" disabled={pending}><LogOut size={17} /> Complete checkout</button></div></form>;
}
