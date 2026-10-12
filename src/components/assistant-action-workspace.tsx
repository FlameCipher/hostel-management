"use client";

import { useActionState, useRef, useState } from "react";
import { createStudentAction } from "@/app/(app)/students/actions";
import { recordPaymentAction } from "@/app/(app)/payments/actions";
import { currencyStep, formatMoney } from "@/lib/currency";

export type AssistantStudentOption = { id: string; label: string; semesterRate: number };
export type AssistantSemesterOption = { id: string; label: string };
export type AssistantChargeOption = {
  id: string; studentName: string; roomNumber: string | null;
  period: string; balance: number; currency: string;
};
export type AssistantWorkspaceData = {
  currency: string;
  roomTypes: AssistantStudentOption[];
  semesters: AssistantSemesterOption[];
  charges: AssistantChargeOption[];
};

type ActionKind = "register" | "payment";
type Review = { rows: { label: string; value: string }[]; note: string };
type Props = { kind: ActionKind; data: AssistantWorkspaceData; onClose: () => void };

function field(form: FormData, name: string) { return String(form.get(name) ?? "").trim(); }
function Preview({ review }: { review: Review }) {
  return <div className="panel mt-4" role="region" aria-label="Review before confirmation">
    <h3>Review the proposed transaction</h3>
    <dl>{review.rows.map(row => <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "7px 0", borderBottom: "1px solid #dce4eb" }}>
      <dt>{row.label}</dt><dd style={{ textAlign: "right", margin: 0, fontWeight: 600 }}>{row.value}</dd>
    </div>)}</dl>
    <p className="muted-note">{review.note}</p>
  </div>;
}
export function AssistantActionWorkspace({ kind, data, onClose }: Props) {
  const studentRef = useRef<HTMLFormElement>(null);
  const paymentRef = useRef<HTMLFormElement>(null);
  const [studentState, studentAction, studentPending] = useActionState(createStudentAction, { error: "" });
  const [paymentState, paymentAction, paymentPending] = useActionState(recordPaymentAction, { error: "" });
  const [review, setReview] = useState<Review | null>(null);
  const [approved, setApproved] = useState(false);
  const [localError, setLocalError] = useState("");
  const [chargeId, setChargeId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("MPESA");
  const chosen = data.charges.find(charge => charge.id === chargeId);
  const pending = kind === "register" ? studentPending : paymentPending;
  const actionError = kind === "register" ? studentState.error : paymentState.error;
  function reset() { setReview(null); setApproved(false); setLocalError(""); }
  function prepare() {
    const form = kind === "register" ? studentRef.current : paymentRef.current;
    if (!form || !form.reportValidity()) return;
    const f = new FormData(form);
    setApproved(false);
    setLocalError("");
    if (kind === "register") {
      const room = data.roomTypes.find(item => item.id === field(f, "roomTypeId"));
      const semester = data.semesters.find(item => item.id === field(f, "semesterId"));
      if (!room || !semester) { setLocalError("Select an active accommodation type and semester."); return; }
      const guardian = field(f, "guardianName"), guardianPhone = field(f, "guardianPhone");
      if (Boolean(guardian) !== Boolean(guardianPhone)) { setLocalError("Enter both guardian name and phone, or leave both blank."); return; }
      setReview({
        rows: [
          { label: "New student", value: field(f, "fullName") },
          { label: "Registered mobile", value: field(f, "phone") },
          { label: "Admission number", value: field(f, "admissionNumber") || "Not supplied" },
          { label: "Guardian", value: guardian || "Not supplied" },
          { label: "Accommodation type", value: room.label },
          { label: "Active semester", value: semester.label },
          { label: "Initial rent charge", value: formatMoney(room.semesterRate, data.currency) },
        ],
        note: "Confirm creates the student and an unpaid semester rent charge. It does not claim any money has been received or allocate a specific room. The existing protected process will open initial payment next.",
      });
    } else {
      const charge = data.charges.find(item => item.id === field(f, "chargeId"));
      const amount = Number(field(f, "amount"));
      const method = field(f, "method");
      const reference = field(f, "reference");
      const step = currencyStep(data.currency);
      if (!charge || charge.currency !== data.currency) { setLocalError("Select a current outstanding charge in your hostel currency."); return; }
      if (!Number.isFinite(amount) || amount < step || Math.abs(Math.round(amount / step) * step - amount) > 1e-6 || amount > charge.balance) {
        setLocalError("Enter a valid payment amount that does not exceed the displayed balance."); return;
      }
      if (["MPESA", "BANK_TRANSFER", "CARD"].includes(method) && !reference) {
        setLocalError("Provide a verified transaction reference for electronic payments."); return;
      }
      setReview({
        rows: [
          { label: "Student", value: charge.studentName },
          { label: "Room", value: charge.roomNumber ?? "Not yet allocated" },
          { label: "Rent period", value: charge.period },
          { label: "Current balance", value: formatMoney(charge.balance, data.currency) },
          { label: "Payment being recorded", value: formatMoney(amount, data.currency) },
          { label: "Expected remaining", value: formatMoney(Math.max(0, charge.balance - amount), data.currency) },
          { label: "Method", value: method },
          { label: "Transaction reference", value: reference || "Cash / not provided" },
          { label: "Payment date", value: field(f, "paidAt") },
        ],
        note: "Only confirm after independent evidence that the hostel actually received this money. Confirmation calls the existing audited payment service, rechecks the current balance and reference, then opens the receipt or room allocation. This form does not initiate M-Pesa collection.",
      });
    }
  }
  function submissionGuard(event: React.FormEvent<HTMLFormElement>) {
    if (!review || !approved) { event.preventDefault(); setLocalError("Review and explicitly approve before saving."); }
  }
  const today = new Date().toISOString().slice(0, 10);
  return <section className="panel mt-5" aria-label="AI assisted transaction review" id="assistant-transaction">
    <div className="page-heading-row"><div>
      <p className="eyebrow">AI action desk · human-approved</p>
      <h2>{kind === "register" ? "Register a student" : "Record an actual payment"}</h2>
      <p>The AI helps prepare the transaction. The authenticated hostel system validates and saves it only after you approve.</p>
    </div><button type="button" className="secondary-button" disabled={pending} onClick={() => { reset(); onClose(); }}>Close</button></div>
    {kind === "register" ? <form ref={studentRef} action={studentAction} onSubmit={submissionGuard} className="entity-form">
      <div style={review ? { display: "none" } : undefined}>
        <div className="form-grid">
          <label className="field-group"><span>Full student name *</span><input name="fullName" required minLength={2} maxLength={120} /></label>
          <label className="field-group"><span>Registered phone *</span><input name="phone" type="tel" required pattern="[+0-9() .-]{9,20}" /></label>
          <label className="field-group"><span>Email (optional)</span><input name="email" type="email" /></label>
          <label className="field-group"><span>University *</span><input name="university" defaultValue="JKUAT" required /></label>
          <label className="field-group"><span>Admission number</span><input name="admissionNumber" maxLength={50} /></label>
          <label className="field-group"><span>National ID (optional)</span><input name="nationalId" maxLength={30} /></label>
          <label className="field-group"><span>Admission date *</span><input name="admittedAt" type="date" defaultValue={today} required /></label>
          <label className="field-group"><span>Accommodation type *</span><select name="roomTypeId" required defaultValue=""><option value="">Select room type</option>{data.roomTypes.map(item => <option key={item.id} value={item.id}>{item.label} — {formatMoney(item.semesterRate, data.currency)}</option>)}</select></label>
          <label className="field-group"><span>Active semester *</span><select name="semesterId" required defaultValue=""><option value="">Select semester</option>{data.semesters.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        </div>
        <h3 className="mt-5">Guardian or emergency contact · optional</h3>
        <div className="form-grid">
          <label className="field-group"><span>Guardian name</span><input name="guardianName" maxLength={120} /></label>
          <label className="field-group"><span>Guardian phone</span><input name="guardianPhone" type="tel" /></label>
          <label className="field-group"><span>Relationship</span><input name="guardianRelationship" maxLength={50} /></label>
          <label className="field-group"><span>Guardian email</span><input name="guardianEmail" type="email" /></label>
          <label className="field-group form-span-2"><span>Notes</span><textarea name="notes" maxLength={500} /></label>
        </div>
        <input type="hidden" name="status" value="ACTIVE" />
      </div>
      {review && <Preview review={review} />}
      {(localError || actionError) && <p className="form-error" role="alert">{localError || actionError}</p>}
      {review && <label className="check-field mt-4"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} required /> I checked the actual student identity, selected accommodation, semester and rent charge and authorize this registration.</label>}
      <div className="form-actions">
        {review ? <><button type="button" className="secondary-button" onClick={reset} disabled={pending}>Edit details</button>
          <button className="primary-button" type="submit" disabled={!approved || pending}>{pending ? "Registering…" : "Confirm registration and create rent charge"}</button></>
          : <button type="button" className="primary-button" onClick={prepare} disabled={!data.roomTypes.length || !data.semesters.length}>Review registration</button>}
      </div>
    </form> : <form ref={paymentRef} action={paymentAction} onSubmit={submissionGuard} className="entity-form">
      <input type="hidden" name="currency" value={data.currency} />
      <div style={review ? { display: "none" } : undefined}>
        <div className="form-grid">
          <label className="field-group form-span-2"><span>Exact student and outstanding charge *</span>
            <select name="chargeId" required value={chargeId} onChange={e => { setChargeId(e.target.value); reset(); }}>
              <option value="">Select student / rent charge</option>
              {data.charges.map(item => <option key={item.id} value={item.id}>{item.studentName} · {item.roomNumber ? "Room " + item.roomNumber + " · " : ""}{item.period} · {formatMoney(item.balance, data.currency)} outstanding</option>)}
            </select>
          </label>
          <label className="field-group"><span>Amount received ({data.currency}) *</span><input name="amount" type="number" min={currencyStep(data.currency)} step={currencyStep(data.currency)} required /></label>
          <label className="field-group"><span>Payment date *</span><input name="paidAt" type="date" defaultValue={today} required /></label>
          <label className="field-group"><span>Method *</span><select name="method" value={paymentMethod} onChange={e => { setPaymentMethod(e.target.value); reset(); }}>
            {["MPESA", "BANK_TRANSFER", "CASH", "CARD", "OTHER"].map(item => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </select></label>
          <label className="field-group"><span>{["MPESA", "BANK_TRANSFER", "CARD"].includes(paymentMethod) ? "Verified transaction reference *" : "Reference (optional)"}</span><input name="reference" maxLength={100} required={["MPESA", "BANK_TRANSFER", "CARD"].includes(paymentMethod)} /></label>
          <label className="field-group"><span>Next partial-balance due date (optional)</span><input name="nextBalanceDueDate" type="date" /></label>
          <label className="field-group form-span-2"><span>Notes</span><textarea name="notes" maxLength={500} /></label>
        </div>
        {chosen && <p className="muted-note">Selected outstanding charge: {formatMoney(chosen.balance, data.currency)}. Only enter a payment already received by the hostel.</p>}
      </div>
      {review && <Preview review={review} />}
      {(localError || actionError) && <p className="form-error" role="alert">{localError || actionError}</p>}
      {review && <label className="check-field mt-4"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} required /> I verified the actual incoming payment, correct student, reference and amount. I authorize the ledger entry and receipt.</label>}
      <div className="form-actions">
        {review ? <><button type="button" className="secondary-button" onClick={reset} disabled={pending}>Edit payment</button><button type="submit" className="primary-button" disabled={!approved || pending}>{pending ? "Recording…" : "Confirm payment and issue receipt"}</button></>
          : <button type="button" className="primary-button" disabled={!data.charges.length} onClick={prepare}>Review payment</button>}
      </div>
    </form>}
    <p className="muted-note">Only authorized active management users can save. The existing server actions independently enforce permissions, currency, duplicate identities, transaction references, current outstanding balance, receipt numbering and audit rules.</p>
  </section>;
}
