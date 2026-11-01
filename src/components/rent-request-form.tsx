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
  const [chargeId, setChargeId] = useState(selectedId || "");
  const [search, setSearch] = useState("");
  const [payer, setPayer] = useState("student");
  const charge = charges.find(c => c.id === chargeId);
  const contact = payer === "student" ? charge?.student : payer === "guardian" ? charge?.guardian : undefined;
  if (!charges.length) return <p>No outstanding charges. Add a charge before requesting payment.</p>;
  return <form action={submit} className={styles.form}>
    <input type="hidden" name="requestId" value={requestId}/>
    <input type="hidden" name="delivery" value="checkout"/>
    <ol className={styles.steps} aria-label="M-Pesa payment steps">
      <li><strong>Enter details</strong><span>Student, amount and M-Pesa number.</span></li>
      <li><strong>Send the prompt</strong><span>On Pesapal, confirm the number and tap Proceed.</span></li>
      <li><strong>Confirm on phone</strong><span>The payer enters their PIN. Receipt follows after verification.</span></li>
    </ol>
    <input type="hidden" name="chargeId" value={chargeId}/>
    <details className={styles.picker} key={chargeId} open={!charge}>
      <summary>{charge ? <><strong>{charge.student.name}</strong><span>{charge.label.slice(charge.student.name.length).replace(/^ · /, "")} · {formatMoney(charge.balance, "KES")} due</span><small>Change student</small></> : <strong>Choose a student</strong>}</summary>
      <label>Find student or room<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Type a name or room number"/></label>
      <fieldset className={styles.chargeChoices}><legend>Students with unpaid balances</legend>{charges.filter(c => c.label.toLowerCase().includes(search.toLowerCase().trim())).map(c => <label className={styles.chargeChoice} key={c.id}><input type="radio" name="chargeChoice" checked={chargeId === c.id} onChange={() => { setChargeId(c.id); setPayer("student"); setSearch(""); }}/><span><strong>{c.student.name}</strong><small>{c.label.slice(c.student.name.length).replace(/^ · /, "")}</small></span><strong>{formatMoney(c.balance, "KES")}</strong></label>)}{!charges.some(c => c.label.toLowerCase().includes(search.toLowerCase().trim())) && <p>No matching student or room.</p>}</fieldset>
    </details>
    <label key={chargeId}>Amount to pay (KES)<input name="amount" type="number" min="0.01" step="0.01" max={charge?.balance} defaultValue={charge?.balance} required/></label>
    <label>Who will pay?<select value={payer} onChange={event => setPayer(event.target.value)}><option value="student">{tenant ? "I will pay" : "Student"}</option>{!tenant && charge?.guardian && <option value="guardian">Parent / guardian</option>}<option value="other">Someone else</option></select></label>
    <fieldset key={chargeId + payer}><legend>Payer details</legend>
      <label>Payer name<input name="payerName" defaultValue={contact?.name || ""} maxLength={100} required autoComplete="name"/></label>
      <label>M-Pesa mobile number<input name="payerPhone" type="tel" inputMode="tel" defaultValue={contact?.phone || ""} maxLength={25} placeholder="07… or +254…" autoComplete="tel" required aria-describedby="mpesa-phone-help"/></label>
      <p id="mpesa-phone-help">Use the number that will receive the prompt. No email needed.</p>
    </fieldset>
    {state.error && <p role="alert">{state.error}</p>}
    <button className="primary-button" disabled={pending || !charge}>{pending ? "Opening M-Pesa checkout…" : "Continue with M-Pesa"}</button>
    <p className={styles.reassurance}>The payer enters their PIN on their own phone. Confirmed payments update the rent balance and receipt automatically.</p>
  </form>;
}

export function ConnectRentGatewayForm({ action }: { action: (state: RentActionState, data: FormData) => Promise<RentActionState> }) {
  const [state, submit, pending] = useActionState(action, { error: "" });
  return <form action={submit} className={styles.form}><label>Pesapal consumer key<input name="consumerKey" type="password" autoComplete="off" maxLength={512} required/></label><label>Pesapal consumer secret<input name="consumerSecret" type="password" autoComplete="off" maxLength={512} required/></label><label><input type="checkbox" name="confirm" value="yes" required/> Connect my SAMPESA live Pesapal account to collect MMAMBUGUA HOSTEL rent and verify payments automatically.</label><p>Your keys are encrypted and never displayed after saving. Connecting verifies access and registers this hostel’s payment notification address. It does not move money or change your settlement account.</p>{state.error && <p role="alert">{state.error}</p>}<button className="primary-button" disabled={pending}>{pending ? "Connecting securely…" : "Connect and enable automatic verification"}</button></form>;
}
