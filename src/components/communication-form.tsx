"use client";
import Link from "next/link";
import styles from "./arrears-form.module.css";
import { useActionState, useState } from "react";
import { publishAction } from "@/app/(app)/communications/actions";

type Audience = "ALL" | "SELECTED";
type NoticeType = "GENERAL" | "EXAM" | "HOLIDAY" | "BALANCE";
const templates: Record<NoticeType, string> = {
  GENERAL: "",
  EXAM: "We wish you success in your examinations. Prepare well, rest sufficiently and respect quiet study hours. Hostel management wishes you all the best.",
  HOLIDAY: "Please contact management before leaving for the holiday to confirm whether you are returning next semester or vacating, your room reservation and arrangements for your belongings.",
  BALANCE: "Please review your private rent statement and settle any outstanding balance by the deadline communicated by management. If a payment is missing, contact management for verification. If you have paid in full, please disregard this notice.",
};

export function CommunicationForm({
  students,
  requestId,
}: {
  students: Array<{ id: string; fullName: string; portalReady: boolean; room: string; balance: string; paymentStatus: string }>;
  requestId: string;
}) {
  const [state, action, pending] = useActionState(publishAction, {});
  const [audience, setAudience] = useState<Audience>("SELECTED");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<NoticeType>("GENERAL");
  const [body, setBody] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const visible = students.filter(student =>
    `${student.fullName} ${student.room}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );
  const recipientCount = audience === "ALL" ? students.length : selected.length;
  const selectedIds = new Set(selected);
  const accessiblePortals = students.filter(student =>
    student.portalReady && (audience === "ALL" || selectedIds.has(student.id))
  ).length;
  const pendingPortalAccess = recipientCount - accessiblePortals;

  function changeAudience(next: Audience) {
    setAudience(next);
    setConfirmed(false);
  }
  function toggleTenant(id: string, checked: boolean) {
    setSelected(previous => checked ? [...new Set([...previous, id])] : previous.filter(value => value !== id));
    setConfirmed(false);
  }
  function selectVisible() {
    setSelected(previous => [...new Set([...previous, ...visible.map(student => student.id)])]);
    setConfirmed(false);
  }

  return <form action={action} className="panel entity-form">
    <h2>Publish a tenant notice</h2><p><Link className="primary-button" href="/reports/arrears">Prepare overdue rent demands</Link></p><p>Rent demands automatically exclude paid accounts and approved payment extensions.</p>
    <p>Choose recipients, write the notice, and review access before publishing. Each recipient gets a private inbox record, not a group chat or guaranteed delivered phone message.</p>
    <input name="requestId" type="hidden" value={requestId}/>
    <input name="expectedRecipientCount" type="hidden" value={recipientCount}/>

    <fieldset>
      <legend><strong>1. Send to</strong></legend>
      <label className="check-field">
        <input type="radio" name="audience" value="ALL" checked={audience === "ALL"} onChange={() => changeAudience("ALL")}/>
        <span><strong>All tenants</strong> ({students.length})</span>
      </label>
      <label className="check-field">
        <input type="radio" name="audience" value="SELECTED" checked={audience === "SELECTED"} onChange={() => changeAudience("SELECTED")}/>
        <span><strong>Selected tenants</strong></span>
      </label>
    </fieldset>

    {audience === "SELECTED" && <fieldset>
      <legend>Choose tenants</legend>
      <label className="field-group">
        <span>Find tenant</span>
        <input type="search" placeholder="Search by name or room" value={search} onChange={event => setSearch(event.target.value)}/>
      </label>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button className="secondary-button" type="button" onClick={selectVisible} disabled={!visible.length}>Select all shown</button>
        <button className="secondary-button" type="button" onClick={() => { setSelected([]); setConfirmed(false); }} disabled={!selected.length}>Clear selection</button>
      </div>
      <div className={styles.recipientList}>
        {visible.length ? visible.map(student => <label className={styles.recipientRow} key={student.id}>
          <input type="checkbox" value={student.id} checked={selected.includes(student.id)} onChange={event => toggleTenant(student.id,event.target.checked)}/>
          <span><strong>{student.fullName}</strong><small>Room {student.room || "—"} · {student.paymentStatus}</small></span><strong>{student.balance}</strong>
        </label>) : <p>No matching tenants.</p>}
      </div>
      {/* Keep the complete chosen audience in the form even when search hides checkboxes.
          Never derive submitted studentIds from only the currently visible results. */}
      {selected.map(id => <input key={id} type="hidden" name="studentIds" value={id}/>)}
      <p role="status"><strong>{selected.length} tenant{selected.length === 1 ? "" : "s"} selected</strong></p>
    </fieldset>}

    <h3>2. Write your notice</h3>
    <label className="field-group"><span>Subject</span>
      <input name="title" required minLength={3} maxLength={160} placeholder="e.g. Rent balance clearance" onChange={() => setConfirmed(false)}/>
    </label>
    <label className="field-group"><span>Message type</span>
      <select name="category" value={category} onChange={event => {
        setCategory(event.target.value as NoticeType);
        setBody(templates[event.target.value as NoticeType]);
        setConfirmed(false);
      }}>
        <option value="GENERAL">General notice</option>
        <option value="BALANCE">Rent balance reminder</option>
        <option value="EXAM">Examination wishes</option>
        <option value="HOLIDAY">Holiday arrangements</option>
      </select>
    </label>
    {category === "BALANCE" && <p role="status">Use <Link href="/reports/arrears">Rent payment demands</Link> for individual balances and agreed-date exclusions.</p>}
    <label className="field-group"><span>Message</span>
      <textarea name="body" required minLength={10} maxLength={3000} rows={5} value={body} placeholder="Write the notice here…" onChange={event => {setBody(event.target.value);setConfirmed(false);}}/>
    </label>

    <details>
      <summary>More options: schedule, email and WhatsApp</summary>
      <label className="field-group"><span>Schedule (Nairobi time; leave blank to post now)</span>
        <input name="publishAt" type="datetime-local" onChange={() => setConfirmed(false)}/>
      </label>
      <label className="check-field"><input name="email" type="checkbox" onChange={() => setConfirmed(false)}/>Queue an email copy for tenants with an email address</label>
      <label className="check-field"><input name="whatsapp" type="checkbox" onChange={() => setConfirmed(false)}/>Prepare WhatsApp copies for manual sending</label>
      <p className="policy-note">Email is processed by the configured delivery service. WhatsApp copies are queued as drafts and are not automatically sent by this option.</p>
    </details>

    <h3>3. Review and send</h3>
    <p role="status"><strong>{recipientCount} private notice record{recipientCount === 1 ? "" : "s"} will be saved</strong> in the hostel system. {accessiblePortals} selected recipient{accessiblePortals === 1 ? "" : "s"} currently have enabled portal access.</p>
    {pendingPortalAccess > 0 && <p className="policy-note" role="status"><strong>{pendingPortalAccess} selected tenant{pendingPortalAccess === 1 ? "" : "s"} cannot yet read their hostel inbox because their portals are not activated.</strong> Their notices stay saved. Email copies must be separately requested and successfully delivered; WhatsApp copies are drafts requiring manual sending or a verified automated sender.</p>}
    <p className="policy-note">Saved, queued and drafted notices are <strong>not proof of delivery or reading</strong>. Check the message history and delivery statuses before assuming tenants were notified.</p>
    {audience === "ALL" && <p className="policy-note">This includes tenants who have already paid. For a rent-arrears notice, choose Selected tenants if you only want to contact those who owe. Never put a named tenant’s balance in a notice to everyone.</p>}
    <label className="check-field">
      <input type="checkbox" name="confirmed" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>
      I have checked the recipients and the message.
    </label>

    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.success && <p className="form-success" role="status">{state.success}</p>}
    <button type="submit" className="primary-button" disabled={pending || !!state.success || recipientCount === 0 || !confirmed || category === "BALANCE"}>
      {pending ? "Saving…" : `Save notices for ${recipientCount} tenant${recipientCount === 1 ? "" : "s"}`}
    </button>
    {state.success && <a className="secondary-button" href="/communications">Write another notice</a>}
  </form>;
}
