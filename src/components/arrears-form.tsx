"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Send, MessageCircle, ChevronDown } from "lucide-react";
import { sendArrearsAction, forwardArrearsAction, arrearsAutomationAction } from "@/app/(app)/reports/arrears/actions";
import type { ArrearsRow } from "@/lib/arrears-reminders";
import styles from "./arrears-form.module.css";

import { SponsorMessageForm } from "./sponsor-message-form";
import { MessageDeliveryReport } from "./message-delivery-report";

type Row = ArrearsRow & { delivery: string };
export function ArrearsForm({ rows, requestId, sponsorRequestId, whatsappEnabled, businessReady, emailReady, showRecipientTarget=true }: { rows: Row[]; requestId: string; sponsorRequestId: string; showRecipientTarget?: boolean; whatsappEnabled: boolean; businessReady: boolean; emailReady: boolean }) {
  const [selected, setSelected] = useState<string[]>([]), [query, setQuery] = useState("");
  const [target,setTarget]=useState("STUDENTS");
  const [channel,setChannel] = useState(whatsappEnabled?"WHATSAPP":"PORTAL");
  const [state, action, pending] = useActionState(sendArrearsAction, {});
  const chosen = rows.filter(row => selected.includes(row.studentId));
  const visible = rows.filter(row => `${row.name} ${row.room} ${row.phone}`.toLowerCase().includes(query.toLowerCase().trim()));
  const toggle = (id: string) => setSelected(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);
  return <>{showRecipientTarget&&<label className="field-group"><span>Send the reminder to</span><select value={target} onChange={e=>setTarget(e.target.value)}><option value="STUDENTS">Students</option><option value="SPONSOR">Sponsor or guardian — type a number</option></select></label>}{target==="SPONSOR"?<SponsorMessageForm students={rows.map(row=>({id:row.studentId,name:row.name,fingerprint:row.fingerprint}))} requestId={sponsorRequestId} rent/>:<form action={action} className={styles.form}>
    <input type="hidden" name="requestId" value={requestId}/>
    <input type="hidden" name="recipients" value={JSON.stringify(chosen.map(row => ({ studentId: row.studentId, fingerprint: row.fingerprint })))}/>
    <h3>2. Choose students with unpaid rent</h3><p className={styles.note}>Paid accounts and approved payment extensions are excluded. Dates, balances and each student’s message are filled in automatically.</p><div className={styles.selection}><button type="button" onClick={()=>setSelected(rows.slice(0,500).map(row=>row.studentId))}>Select all unpaid ({Math.min(rows.length,500)})</button></div>
    <div className={styles.toolbar}><label className={styles.search}>Find a tenant<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, room or phone"/></label><div className={styles.selection}><button type="button" onClick={() => setSelected([...new Set([...selected, ...visible.slice(0, 500).map(row => row.studentId)])].slice(0, 500))}>Select all shown</button><button type="button" onClick={() => setSelected([])}>Clear</button></div></div>
    <div className={styles.sendBox}><h3>3. Send to {chosen.length} students</h3><span>Each student receives only their own balance and payment link.</span>
      <label className="field-group"><span>Send through</span><select value={channel} onChange={e=>setChannel(e.target.value)}><option value="WHATSAPP" disabled={!whatsappEnabled}>WhatsApp{!businessReady?" — manual sending":""}</option><option value="PORTAL">Student inbox</option><option value="EMAIL" disabled={!emailReady}>Email{!emailReady?" — not connected":""}</option></select></label>
      <input type="hidden" name="whatsapp" value={channel==="WHATSAPP"?"on":""}/><input type="hidden" name="email" value={channel==="EMAIL"?"on":""}/>
      {channel==="WHATSAPP"&&!businessReady?<p><strong>Automatic WhatsApp is not connected.</strong> Saving drafts sends 0 phone messages. Open and send each draft yourself, or <Link href="/communications/whatsapp">connect WhatsApp to send to everyone</Link>.</p>:channel==="WHATSAPP"?<p>Messages are queued for students who have opted in. Delivery results show who was sent a message.</p>:channel==="PORTAL"?<p>{chosen.filter(row=>row.portalReady).length} selected students can read their inbox now; {chosen.filter(row=>!row.portalReady).length} need to activate their account.</p>:<p>Students without email are shown in the results. You can use WhatsApp for them.</p>}
      <button className={styles.primary} disabled={!chosen.length || pending || !!state.success}><Send size={17} aria-hidden="true"/>{pending?"Saving messages…":channel==="WHATSAPP"&&!businessReady?`Save ${chosen.length} WhatsApp drafts`:`Send reminder to ${chosen.length} students`}</button>
    </div>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}
    {state.report&&<MessageDeliveryReport report={state.report}/>}
    {state.reportId&&!state.report&&<Link href={`/communications/delivery?batch=${encodeURIComponent(state.reportId)}`}>View results for every student</Link>}
    {state.success&&<Link href="/reports/arrears">Start another selection</Link>}
    <div className={styles.list}>{visible.map(row => <article className={styles.tenant} key={row.studentId}>
      <label className={styles.tenantHeader}><input type="checkbox" checked={selected.includes(row.studentId)} onChange={() => toggle(row.studentId)} disabled={pending || (!selected.includes(row.studentId) && selected.length >= 500)}/><span><strong>{row.name}</strong><small>Room {row.room || "—"} · Due {row.due}</small></span><strong className={styles.amount}>{row.balance}</strong></label>
      <div className={styles.tenantFooter}><span>{row.lastAt ? `${new Date(row.lastAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ` : ""}{row.delivery}{row.lastEmailStatus && row.lastEmailStatus !== "NOT_REQUESTED" ? ` · Email: ${row.lastEmailStatus.replaceAll("_", " ").toLowerCase()}` : ""}{!row.portalReady ? " · Portal not activated" : ""}</span><button type="submit" formAction={forwardArrearsAction.bind(null, row.studentId, row.fingerprint, requestId)} disabled={!row.phone || !whatsappEnabled || pending}><MessageCircle size={16} aria-hidden="true"/>Open WhatsApp for this student</button></div>
      {!row.phone && <p className={styles.note}>Add a valid tenant phone number to forward on WhatsApp.</p>}
      <details><summary>Preview reminder<ChevronDown size={16} aria-hidden="true"/></summary><p className={styles.preview}>{row.message}</p><Link href={`/students/${row.studentId}`}>Open tenant account</Link> · <Link href={`/reports/arrears?agreement=${encodeURIComponent(row.studentId)}`}>Agree a different payment date</Link></details>
    </article>)}</div>
    {!visible.length && <p className={styles.empty}>{rows.length ? "No matching tenants." : "No overdue balances for current tenants."}</p>}
  </form>}</>;
}
export function ArrearsAutomationForm({ enabled, whatsapp, email, whatsappEnabled, emailReady }: { enabled: boolean; whatsapp: boolean; email: boolean; whatsappEnabled: boolean; emailReady: boolean }) {
  const [state, action, pending] = useActionState(arrearsAutomationAction, {});
  return <details className={styles.automation}><summary>Automatic follow-ups <span>{enabled ? "On" : "Off"}</span><ChevronDown size={18} aria-hidden="true"/></summary><form action={action}><label><input name="enabled" type="checkbox" defaultChecked={enabled}/>Automatically request overdue payments</label><p>Checked daily at 8 a.m. Nairobi time. One request per tenant every 7 days while overdue. Cleared balances and approved payment extensions are skipped, and queued copies are checked again before sending.</p><label><input name="whatsapp" type="checkbox" defaultChecked={whatsapp} disabled={!whatsappEnabled}/>WhatsApp copies</label><label><input name="email" type="checkbox" defaultChecked={email} disabled={!emailReady}/>Email copies{!emailReady ? " (not connected)" : ""}</label><button className={styles.primary} disabled={pending}>{pending ? "Saving…" : "Save automatic reminders"}</button>{state.error && <p className={styles.error} role="alert">{state.error}</p>}{state.success && <p className={styles.success} role="status">{state.success}</p>}</form></details>;
}
