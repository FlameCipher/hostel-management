"use client";
import { useActionState, useState } from "react";
import { prepareWhatsAppAction } from "@/app/(app)/communications/whatsapp/actions";
import styles from "@/app/(app)/communications/whatsapp/whatsapp.module.css";
type Contact = { id: string; name: string; phone: string | null };
export function WhatsAppDraftForm({ tenants, staff, requestId, automatic=false }: { automatic?:boolean; tenants: Contact[]; staff: Contact[]; requestId: string }) {
  const [state, action, pending] = useActionState(prepareWhatsAppAction, {});
  const [audience, setAudience] = useState("TENANTS"), [selection, setSelection] = useState("SELECTED"), [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]), [reviewed, setReviewed] = useState(false);
  const contacts = audience === "TENANTS" ? tenants : staff;
  const visible = contacts.filter(c => `${c.name} ${c.phone ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <form action={action} className={`panel ${styles.compose}`}>
    <h2>Prepare a WhatsApp message</h2><p>Each recipient gets a separate private message. No group is created.</p>
    <input type="hidden" name="requestId" value={requestId}/>
    <div className={styles.formGrid}>
      <label className="field-group"><span>Recipients</span><select name="audience" value={audience} onChange={e => { setAudience(e.target.value); setSelected([]); setSearch(""); setReviewed(false); }}><option value="TENANTS">Current students / tenants</option><option value="STAFF">Active management and staff</option></select></label>
    </div>
    <fieldset>
      <legend><strong>Send to</strong></legend>
      <label className="check-field"><input type="radio" name="selection" value="ALL" checked={selection === "ALL"} onChange={() => {setSelection("ALL");setReviewed(false);}}/>All {audience === "TENANTS" ? "tenants" : "staff"} ({contacts.length})</label>
      <label className="check-field"><input type="radio" name="selection" value="SELECTED" checked={selection === "SELECTED"} onChange={() => {setSelection("SELECTED");setReviewed(false);}}/>Selected {audience === "TENANTS" ? "tenants" : "staff"}</label>
    </fieldset>
 
    {selection === "SELECTED" ? <fieldset className={styles.recipients}>
      <legend>Choose one or more recipients</legend>
      <label className="field-group"><span>Find a contact</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or phone number"/></label>
      <div className={styles.actions}>
        <button className="secondary-button" type="button" disabled={!visible.length} onClick={() => {setSelected(ids => [...new Set([...ids,...visible.map(c=>c.id)])]);setReviewed(false);}}>Select all shown</button>
        <button className="secondary-button" type="button" disabled={!selected.length} onClick={() => {setSelected([]);setReviewed(false);}}>Clear selection</button>
      </div>
      <div className={styles.contactList}>{visible.length ? visible.map(c => <label key={c.id} className={styles.contactChoice}>
        <input type="checkbox" checked={selected.includes(c.id)} onChange={e => {setSelected(ids => e.target.checked ? [...new Set([...ids, c.id])] : ids.filter(id => id !== c.id));setReviewed(false);}}/>
        <span><strong>{c.name}</strong><small>{c.phone || "Phone number needed"}</small></span>
      </label>) : <p>No matching contacts.</p>}</div>
      {selected.map(id => <input key={id} type="hidden" name="recipientIds" value={id}/>)}
      <p>{selected.length} selected</p>
    </fieldset> : <p>{contacts.length} recipients. Check that this message is suitable for everyone; send individual balances privately.</p>}
    <label className="field-group"><span>Message</span><textarea name="message" required minLength={3} maxLength={automatic?800:3000} rows={5} placeholder="Write your message to tenants or staff…" onChange={() => setReviewed(false)}/></label>
    <p className={styles.note}>{automatic?"Your business sender will send eligible messages automatically to opted-in recipients. Review the message and recipients before queueing. Other messages remain as manual drafts.":"Use international phone numbers, for example +254714464701. Open each draft, review it and tap Send in WhatsApp."}</p>
    <p role="status"><strong>{selection === "ALL" ? contacts.length : selected.length} recipient{(selection === "ALL" ? contacts.length : selected.length) === 1 ? "" : "s"} selected.</strong> Each message stays private.</p>
    <label className="check-field"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}/>I have checked the recipients and message.</label>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}
    {state.success && <p className={styles.success} role="status">{state.success}</p>}
    <div className={styles.actions}><button className="primary-button" disabled={pending || !!state.success || (selection === "ALL" ? contacts.length : selected.length) === 0 || !reviewed}>{pending ? "Preparing…" : automatic?"Queue private messages":"Prepare private drafts"}</button>{state.success && <a className="secondary-button" href="/communications/whatsapp">Write another message</a>}</div>
  </form>;
}
