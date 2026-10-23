"use client";
import { useCurrency } from "@/components/currency-context";
import { formatMoney, currencyStep } from "@/lib/currency";

import { PaymentBalanceDueDate } from "@/components/payment-balance-due-date";
import { FormSelect } from "@/components/form-select";
import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowLeft, Banknote, CheckCircle2, LoaderCircle, Plus, Search } from "lucide-react";
import { createChargeAction, recordPaymentAction, type FinanceFormState } from "@/app/(app)/payments/actions";

const initialState: FinanceFormState = { error: "" };
type Option = { id: string; label: string };
type ChargeOption = Option & { balance: number; studentId: string; studentName: string; roomNumber: string | null; period: string; description: string; needsReview?: boolean };

export function ChargeForm({ students, semesters, roomTypes, selectedSemesterId }: { students: Option[]; semesters: Option[]; roomTypes: Option[]; selectedSemesterId?: string }) {
  const currency = useCurrency();
  const [state, action, pending] = useActionState(createChargeAction, initialState);
  return <form action={action} className="panel entity-form"><input type="hidden" name="currency" value={currency} /><div className="form-section-heading"><div><p className="panel-kicker">Semester enrolment and receivable</p><h2>Add an existing student to a semester</h2><p>Select a previous or current student record. Do not create the student again.</p></div></div><div className="form-grid"><label className="field-group"><span>Student *</span><FormSelect name="studentId" required><option value="">Select existing student</option>{students.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</FormSelect></label><label className="field-group"><span>Charge type *</span><FormSelect defaultValue="SEMESTER_RENT" name="type"><option value="SEMESTER_RENT">Semester rent</option><option value="DAMAGE">Damage</option><option value="OTHER">Other</option></FormSelect></label><label className="field-group"><span>Semester</span><FormSelect defaultValue={selectedSemesterId ?? ""} name="semesterId"><option value="">Not semester-specific</option>{semesters.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</FormSelect></label><label className="field-group"><span>Accommodation type</span><FormSelect name="roomTypeId"><option value="">Not accommodation-specific</option>{roomTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</FormSelect><small>Required for semester rent before room allocation.</small></label><label className="field-group"><span>Amount ({currency}) *</span><input min={currencyStep(currency)} name="amount" step={currencyStep(currency)} type="number" required /></label><label className="field-group"><span>Due date *</span><input name="dueDate" type="date" required /></label><label className="field-group form-span-2"><span>Description *</span><input maxLength={160} name="description" placeholder="e.g. September–December 2026 semester rent" required /></label></div>{state.error ? <p className="form-error" role="alert">{state.error}</p> : null}<div className="form-actions"><Link className="secondary-button no-underline" href="/payments"><ArrowLeft size={17} /> Cancel</Link><button className="primary-button" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" size={17} /> : <Plus size={17} />} Add semester charge</button></div></form>;
}

function OutstandingChargeSelector({ charges, selected, onSelect, money }: { charges: ChargeOption[]; selected: string; onSelect: (id: string) => void; money: (value: number) => string }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const chosen = charges.find((item) => item.id === selected);
  const filtered = charges.filter((item) => [item.studentName, item.roomNumber ?? "", item.period, item.description].join(" ").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <div className="field-group form-span-2 outstanding-selector">
    <span>Outstanding balance *</span>
    <input type="hidden" name="chargeId" value={selected} />
    <button type="button" className="outstanding-selector-trigger" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span>{chosen ? <><strong>{chosen.studentName}</strong><small>{chosen.roomNumber ? `Room ${chosen.roomNumber} · ` : ""}{chosen.period} · {money(chosen.balance)} outstanding</small></> : <strong>Select outstanding balance</strong>}</span>
      <span>{open ? "Close" : "Choose charge"}</span>
    </button>
    {open ? <div className="outstanding-selector-panel">
      <label className="outstanding-selector-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label="Search outstanding balances by student, room or period" placeholder="Search student, room or period..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <p className="muted-note">{filtered.length} matching outstanding balance{filtered.length === 1 ? "" : "s"}</p>
      <div className="outstanding-selector-options" role="group" aria-label="Outstanding balances">
        {filtered.map((item) => <button key={item.id} type="button" aria-pressed={selected === item.id} className={`outstanding-selector-card ${selected === item.id ? "is-selected" : ""}`} onClick={() => { onSelect(item.id); setOpen(false); }}>
          <span className="outstanding-selector-card-top"><strong>{item.studentName}</strong>{selected === item.id ? <CheckCircle2 size={20} aria-label="Selected" /> : null}</span>
          <span className="outstanding-selector-meta">{item.roomNumber ? `Room ${item.roomNumber} · ` : ""}{item.period}</span>
          <span className="outstanding-selector-description">{item.description}</span>{item.needsReview ? <small className="muted-note">Room type differs from original charge. Management review is advised; the amount has not been recalculated.</small> : null}
          <span className="outstanding-selector-balance"><small>Outstanding balance</small><strong>{money(item.balance)}</strong></span>
        </button>)}
        {!filtered.length ? <p className="muted-note">No matching outstanding balances.</p> : null}
      </div>
    </div> : null}
    {!selected ? <small>Select a charge before recording payment.</small> : null}
  </div>;
}

export function PaymentForm({ charges, selectedChargeId, intake = false }: { charges: ChargeOption[]; selectedChargeId?: string; intake?: boolean }) {
  const currency = useCurrency();
  const money = (value: number) => formatMoney(value, currency);
  const [state, action, pending] = useActionState(recordPaymentAction, initialState);
  const [selected, setSelected] = useState(selectedChargeId && charges.some(item => item.id === selectedChargeId) ? selectedChargeId : "");
  const [amount, setAmount] = useState("");
  const chosen = charges.find(item => item.id === selected);
  const today = new Date().toISOString().slice(0, 10);
  return <form action={action} className="panel entity-form"><input type="hidden" name="currency" value={currency} /><div className="form-section-heading"><div><p className="panel-kicker">Collection</p><h2>{intake ? "Initial payment" : "Record payment"}</h2>{intake ? <p>A room can only be allocated after this payment is successfully recorded.</p> : null}</div></div><div className="form-grid"><OutstandingChargeSelector charges={charges} selected={selected} onSelect={setSelected} money={money} /><label className="field-group"><span>Amount paid ({currency}) *</span><input min={currencyStep(currency)} name="amount" value={amount} onChange={event => setAmount(event.target.value)} max={chosen?.balance} step={currencyStep(currency)} type="number" required /></label><label className="field-group"><span>Payment date *</span><input defaultValue={today} name="paidAt" type="date" required /></label><label className="field-group"><span>Payment method *</span><FormSelect defaultValue="MPESA" name="method"><option value="MPESA">M-Pesa</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="CARD">Card</option><option value="OTHER">Other</option></FormSelect></label><label className="field-group"><span>M-Pesa / reference number</span><input maxLength={100} name="reference" placeholder="Required for electronic payments" /></label><PaymentBalanceDueDate key={selected} balance={chosen?.balance} amount={amount} currency={currency} /><label className="field-group form-span-2"><span>Notes</span><textarea maxLength={500} name="notes" rows={3} /></label></div>{state.error ? <p className="form-error" role="alert">{state.error}</p> : null}<div className="form-actions"><Link className="secondary-button no-underline" href="/payments"><ArrowLeft size={17} /> Cancel</Link><button className="primary-button" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" size={17} /> : <Banknote size={17} />} {intake ? "Save payment and allocate room" : "Save and open receipt"}</button></div></form>;
}
