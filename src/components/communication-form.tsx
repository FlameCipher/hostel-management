"use client";
import { SponsorMessageForm } from "./sponsor-message-form";
import Link from "next/link";
import styles from "./arrears-form.module.css";
import { useActionState, useState } from "react";
import { publishAction } from "@/app/(app)/communications/actions";
import { ArrearsForm } from "./arrears-form";
import type { ArrearsRow } from "@/lib/arrears-reminders";
import { MessageDeliveryReport } from "./message-delivery-report";
export type Audience = "ALL" | "SELECTED" | "MALE" | "FEMALE" | "UNPAID";
type NoticeType = "GENERAL" | "EXAM" | "HOLIDAY" | "BALANCE";
const templates = {
 GENERAL:{title:"",body:""},
 EXAM:{title:"Examination wishes",body:"We wish you success in your examinations. Prepare well, rest sufficiently and respect quiet study hours. Hostel management wishes you all the best."},
 HOLIDAY:{title:"Holiday arrangements",body:"Please contact management before leaving for the holiday to confirm whether you are returning next semester or vacating, your room reservation and arrangements for your belongings."},
};
export function CommunicationForm({students,requestId,arrearsRequestId,sponsorRequestId,initialAudience="ALL",arrearsRows,whatsappEnabled,businessReady,emailReady}:{
 students:Array<{id:string;fullName:string;portalReady: boolean;room:string;balance:string;paymentStatus:string;gender:string|null}>;
 requestId:string;arrearsRequestId:string;sponsorRequestId:string;initialAudience?:Audience;arrearsRows:(ArrearsRow & {delivery:string})[];whatsappEnabled:boolean;businessReady:boolean;emailReady:boolean;
}) {
 const [state,action,pending]=useActionState(publishAction,{});
 const [target,setTarget]=useState("STUDENTS");
 const [category,setCategory]=useState<NoticeType>("GENERAL");
 const [body,setBody]=useState(""); const [title,setTitle]=useState("");
 const [audience,setAudience]=useState<Audience>(initialAudience);
 const [selected,setSelected]=useState<string[]>([]); const [search,setSearch]=useState("");
 const [channel,setChannel]=useState(whatsappEnabled?"WHATSAPP":"PORTAL");
 const overdueIds=new Set(arrearsRows.map(row=>row.studentId));
 const recipients=students.filter(s=>audience==="ALL" || (audience==="SELECTED"?selected.includes(s.id):audience==="UNPAID"?overdueIds.has(s.id):s.gender===audience));
 const visible=students.filter(s=>`${s.fullName} ${s.room}`.toLowerCase().includes(search.trim().toLowerCase()));
 const recipientCount=recipients.length;
 const pendingPortalAccess=recipients.filter(s=>!s.portalReady).length;
 return <section className="panel entity-form"><h2>Send a message</h2>
 <label className="field-group"><strong>1. Choose a message</strong><select value={category} onChange={e=>{const next=e.target.value as NoticeType;setCategory(next);if(next!=="BALANCE"){setBody(templates[next].body);setTitle(templates[next].title);}}}>
 <option value="GENERAL">Write a message</option><option value="BALANCE">Unpaid rent reminder</option><option value="EXAM">Examination wishes</option><option value="HOLIDAY">Holiday arrangements</option></select></label>
 <label className="field-group"><span>Who should receive the message?</span><select value={target} onChange={e=>setTarget(e.target.value)}><option value="STUDENTS">Students</option><option value="SPONSOR">Sponsor or guardian — type a number</option></select></label>
 {target==="SPONSOR"?<SponsorMessageForm key={category} students={category==="BALANCE"?arrearsRows.map(row=>({id:row.studentId,name:row.name,fingerprint:row.fingerprint})):students.map(s=>({id:s.id,name:s.fullName}))} requestId={sponsorRequestId} rent={category==="BALANCE"} title={title} body={body}/>:category==="BALANCE"?<ArrearsForm rows={arrearsRows} showRecipientTarget={false} requestId={arrearsRequestId} sponsorRequestId={sponsorRequestId} whatsappEnabled={whatsappEnabled} businessReady={businessReady} emailReady={emailReady}/>:<form action={action} className={styles.form}>
 <input name="requestId" type="hidden" value={requestId}/><input name="category" type="hidden" value={category}/>
 <input name="expectedRecipientCount" type="hidden" value={recipientCount}/><input name="audience" type="hidden" value={audience}/>
 {recipients.map(s=><input key={s.id} type="hidden" name="reviewedStudentIds" value={s.id}/>)}
 {selected.map(id => <input key={id} type="hidden" name="studentIds" value={id}/>)}
 <label className="field-group"><span>Subject</span><input name="title" required minLength={3} maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Message subject"/></label>
 <label className="field-group"><span>Message</span><textarea name="body" required minLength={10} maxLength={channel==="WHATSAPP"?700:3000} rows={5} value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your message…"/></label>
 <label className="field-group"><strong>2. Choose recipients</strong><select value={audience} onChange={e=>setAudience(e.target.value as Audience)}>
 <option value="ALL">All students ({students.length})</option><option value="UNPAID">Unpaid — overdue balances ({arrearsRows.length})</option><option value="SELECTED">Select students</option>
 <option value="MALE">Male students ({students.filter(s=>s.gender==="MALE").length})</option><option value="FEMALE">Female students ({students.filter(s=>s.gender==="FEMALE").length})</option></select></label>
 {audience==="UNPAID" && <p>Paid accounts, future charges and approved payment extensions are excluded automatically.</p>}
 {audience==="SELECTED"?<><label className="field-group"><span>Find a student</span><input type="search" placeholder="Search by name or room" value={search} onChange={e=>setSearch(e.target.value)}/></label>
 <div className={styles.selection}><button type="button" onClick={()=>setSelected([...new Set([...selected,...visible.map(s=>s.id)])])}>Select all shown</button><button type="button" onClick={()=>setSelected([])}>Clear selection</button></div>
 <div className={styles.recipientList}>{visible.map(s=><label className={styles.recipientRow} key={s.id}><input type="checkbox" checked={selected.includes(s.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,s.id]:ids.filter(id=>id!==s.id))}/><span><strong>{s.fullName}</strong><small>Room {s.room||"—"}</small></span></label>)}</div></>:<details><summary>View {recipientCount} recipients</summary>{recipients.map(s=><p key={s.id}>{s.fullName} · Room {s.room||"—"}</p>)}</details>}
 <h3>3. Send to {recipientCount} student{recipientCount===1?"":"s"}</h3>
 <label className="field-group"><span>Send through</span><select value={channel} onChange={e=>setChannel(e.target.value)}><option value="WHATSAPP" disabled={!whatsappEnabled}>WhatsApp{!businessReady?" — manual sending":""}</option><option value="PORTAL">Student inbox</option><option value="EMAIL" disabled={!emailReady}>Email{!emailReady?" — not connected":""}</option></select></label>
 <input type="hidden" name="whatsapp" value={channel==="WHATSAPP"?"on":""}/><input type="hidden" name="email" value={channel==="EMAIL"?"on":""}/>
 {channel==="WHATSAPP"&&!businessReady?<p className="policy-note"><strong>Automatic WhatsApp is not connected.</strong> This saves {recipientCount} individual drafts; it does not send them to phones. <Link href="/communications/whatsapp">Connect WhatsApp to send to everyone</Link>.</p>:channel==="WHATSAPP"?<p>Messages are queued for students who have opted in. Check results for delivery confirmation.</p>:channel==="PORTAL"?<p>{recipientCount-pendingPortalAccess} students can read their inbox now.{pendingPortalAccess>0?` ${pendingPortalAccess} need to activate their account.`:""}</p>:<p>Email addresses are only needed for this sending method.</p>}
 <p>Each student gets a private message. The results show every selected recipient.</p>
 <button type="submit" name="confirmed" value="on" className={styles.primary} disabled={pending||!!state.success||recipientCount===0}>{pending?"Saving messages…":channel==="WHATSAPP"&&!businessReady?`Save ${recipientCount} WhatsApp drafts`:`Send to ${recipientCount} students`}</button>
 {state.error&&<p className="form-error" role="alert">{state.error}</p>}
 {state.success&&<p role="status">{state.success}</p>}
 {state.report&&<MessageDeliveryReport report={state.report}/>}
 {state.reportId&&!state.report&&<Link href={`/communications/delivery?batch=${encodeURIComponent(state.reportId)}`}>View results for every student</Link>}
 {state.success&&<Link href="/communications">Write another message</Link>}
 </form>}
 </section>;
}
