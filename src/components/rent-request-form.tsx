"use client";
import styles from "./rent-payment.module.css";
import { useActionState, useState } from "react";
import { formatMoney } from "@/lib/currency";

type Contact = { name: string; email: string; phone: string };
export type RentChargeOption = { id: string; label: string; balance: number; student: Contact; guardian?: Contact };
export type RentActionState = { error: string };
export function RentRequestForm({ action, charges, requestId, selectedId, tenant = false }: {
  action: (state: RentActionState, data: FormData) => Promise<RentActionState>;
  charges: RentChargeOption[]; requestId: string; selectedId?: string; tenant?: boolean;
}) {
  const [state, submit, pending] = useActionState(action, { error: "" });
  const [chargeId, setChargeId] = useState(selectedId || charges[0]?.id || "");
  const [payer, setPayer] = useState("student");
  const charge = charges.find(c => c.id === chargeId);
  const contact = payer === "student" ? charge?.student : payer === "guardian" ? charge?.guardian : undefined;
  if (!charges.length) return <p>No outstanding charges. Add a charge before requesting payment.</p>;
  return <form action={submit} className={styles.form}>
    <input type="hidden" name="requestId" value={requestId}/>
    <label>Student and rent charge<select name="chargeId" value={chargeId} onChange={event => setChargeId(event.target.value)} required>{charges.map(c => <option key={c.id} value={c.id}>{c.label} · {formatMoney(c.balance, "KES")} due</option>)}</select></label>
    <label key={chargeId}>Amount to pay (KES)<input name="amount" type="number" min="0.01" step="0.01" max={charge?.balance} defaultValue={charge?.balance} required/></label>
    <label>Who will pay?<select value={payer} onChange={event => setPayer(event.target.value)}><option value="student">{tenant ? "I will pay" : "Student"}</option>{!tenant && charge?.guardian && <option value="guardian">Parent / guardian</option>}<option value="other">Someone else</option></select></label>
    <fieldset key={chargeId + payer}><legend>Payer contact details</legend><p>The payer receives the payment request. The payment credits the student selected above.</p>
      <label>Payer name<input name="payerName" defaultValue={contact?.name || ""} maxLength={100} required autoComplete="name"/></label>
      <label>Email<input name="payerEmail" type="email" defaultValue={contact?.email || ""} maxLength={254} autoComplete="email"/></label>
      <label>Mobile number<input name="payerPhone" type="tel" defaultValue={contact?.phone || ""} maxLength={25} placeholder="07… or +254…" autoComplete="tel"/></label>
      <p>Enter an email address or mobile number. Email is required to send the request automatically by email.</p>
    </fieldset>
    {!tenant && <label>Send the request<select name="delivery"><option value="email">Email the payer now</option><option value="link">Create a link to copy or share</option></select></label>}
    <p>The payer opens secure Pesapal checkout and authorises payment. This does not send an immediate M-Pesa PIN prompt or take money automatically.</p>
    {state.error && <p role="alert">{state.error}</p>}
    <button className="primary-button" disabled={pending}>{pending ? "Preparing request…" : tenant ? "Continue to payment" : "Create payment request"}</button>
  </form>;
}

export function ConnectRentGatewayForm({ action }: { action: (state: RentActionState, data: FormData) => Promise<RentActionState> }) {
  const [state, submit, pending] = useActionState(action, { error: "" });
  return <form action={submit} className={styles.form}><label>Pesapal consumer key<input name="consumerKey" type="password" autoComplete="off" maxLength={512} required/></label><label>Pesapal consumer secret<input name="consumerSecret" type="password" autoComplete="off" maxLength={512} required/></label><label><input type="checkbox" name="confirm" value="yes" required/> Connect my SAMPESA live Pesapal account to collect MMAMBUGUA HOSTEL rent and verify payments automatically.</label><p>Your keys are encrypted and never displayed after saving. Connecting verifies access and registers this hostel’s payment notification address. It does not move money or change your settlement account.</p>{state.error && <p role="alert">{state.error}</p>}<button className="primary-button" disabled={pending}>{pending ? "Connecting securely…" : "Connect and enable automatic verification"}</button></form>;
}
