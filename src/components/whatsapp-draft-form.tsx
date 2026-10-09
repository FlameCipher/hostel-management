"use client";
import { useActionState, useState } from "react";
import { prepareWhatsAppAction } from "@/app/(app)/communications/whatsapp/actions";
import styles from "@/app/(app)/communications/whatsapp/whatsapp.module.css";
type Contact = { id: string; name: string; phone: string | null };
export function WhatsAppDraftForm({ tenants, staff, requestId }: { tenants: Contact[]; staff: Contact[]; requestId: string }) {
  const [state, action, pending] = useActionState(prepareWhatsAppAction, {});
  const [audience, setAudience] = useState("TENANTS"), [selection, setSelection] = useState("SELECTED"), [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const contacts = audience === "TENANTS" ? tenants : staff;
  const visible = contacts.filter(c => `${c.name} ${c.phone ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <form action={action} className={`panel ${styles.compose}`}>
    <h2>Prepare a WhatsApp message</h2><p>Each recipient gets a separate private draft. No group is created.</p>
    <input type="hidden" name="requestId" value={requestId}/>
    <div className={styles.formGrid}>
      <label className="field-group"><span>Recipients</span><select name="audience" value={audience} onChange={e => { setAudience(e.target.value); setSelected([]); setSearch(""); }}><option value="TENANTS">Current students / tenants</option><option value="STAFF">Active management and staff</option></select></label>
      <label className="field-group"><span>Who should receive it?</span><select name="selection" value={selection} onChange={e => setSelection(e.target.value)}><option value="SELECTED">Choose recipients</option><option value="ALL">Everyone in this list</option></select></label>
    </div>
    {selection === "SELECTED" ? <fieldset className={styles.recipients}>
      <legend>Choose one or more recipients</legend>
      <label className="field-group"><span>Find a contact</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or phone number"/></label>
      <div className={styles.contactList}>{visible.length ? visible.map(c => <label key={c.id} className={styles.contactChoice}>
        <input type="checkbox" checked={selected.includes(c.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>
        <span><strong>{c.name}</strong><small>{c.phone || "Phone number needed"}</small></span>
      </label>) : <p>No matching contacts.</p>}</div>
      {selected.map(id => <input key={id} type="hidden" name="recipientIds" value={id}/>)}
      <p>{selected.length} selected</p>
    </fieldset> : <p>{contacts.length} recipients. Check that this message is suitable for everyone; send individual balances privately.</p>}
    <label className="field-group"><span>Message</span><textarea name="message" required minLength={3} maxLength={3000} rows={5} placeholder="Write your message to tenants or staff…"/></label>
    <p className={styles.note}>Use international phone numbers, for example +254714464701. Drafts use the WhatsApp account currently signed in on your device. Open each draft, review it and tap Send in WhatsApp.</p>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}
    {state.success && <p className={styles.success} role="status">{state.success}</p>}
    <div className={styles.actions}><button className="primary-button" disabled={pending || !!state.success}>{pending ? "Preparing…" : "Prepare private drafts"}</button>{state.success && <a className="secondary-button" href="/communications/whatsapp">Write another message</a>}</div>
  </form>;
}
