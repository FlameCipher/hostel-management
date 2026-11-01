"use client";
import Link from "next/link";
import {useActionState,useState} from "react";
import {sponsorMessageAction} from "@/app/(app)/communications/sponsor-actions";
import {MessageDeliveryReport} from "./message-delivery-report";
import styles from "./arrears-form.module.css";
export function SponsorMessageForm({students,requestId,rent=false,title="Message from hostel management",body=""}:{students:{id:string;name:string;fingerprint?:string}[];requestId:string;rent?:boolean;title?:string;body?:string}) {
 const [state,action,pending]=useActionState(sponsorMessageAction,{});
 const [studentId,setStudentId]=useState("");const [name,setName]=useState("");const [phone,setPhone]=useState("");
 return <form action={action} className={styles.form}><h3>Send to a sponsor or guardian</h3><p>Choose one student, then type the person who should receive their message. The student’s registered number stays unchanged.</p>
 <input type="hidden" name="requestId" value={requestId}/><input type="hidden" name="kind" value={rent?"ARREARS":"GENERAL"}/><input type="hidden" name="fingerprint" value={students.find(s=>s.id===studentId)?.fingerprint??""}/>
 <label className="field-group"><span>Student</span><select name="studentId" required value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Choose one student</option>{students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
 <label className="field-group"><span>Recipient name</span><input name="name" required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Sponsor or guardian’s name"/></label>
 <label className="field-group"><span>Recipient mobile number</span><input name="phone" type="tel" inputMode="tel" required maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="07… or +254…"/></label>
 {rent?<><input name="title" type="hidden" value="Unpaid rent reminder for sponsor or guardian"/><input name="body" type="hidden" value=""/><p>The system adds only this student’s current overdue balance, due date and account link. Approved payment extensions are excluded.</p></>:<><label className="field-group"><span>Subject</span><input name="title" required minLength={3} maxLength={160} defaultValue={title||"Message from hostel management"}/></label><label className="field-group"><span>Message</span><textarea name="body" required minLength={10} maxLength={3000} rows={5} defaultValue={body}/></label></>}
 <p><strong>Recipient: {name||"Not entered"} · {phone||"Number needed"}</strong></p><p>No email is needed. This creates one WhatsApp draft. Open it and tap Send in WhatsApp; automatic sponsor delivery is not connected.</p>
 <button className={styles.primary} disabled={pending||!!state.success||!studentId||!name.trim()||!phone.trim()}>{pending?"Saving…":"Create recipient’s WhatsApp message"}</button>
 {state.error&&<p role="alert" className="form-error">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}{state.report&&<MessageDeliveryReport report={state.report}/>}{state.success&&<Link href="/communications">Write another message</Link>}
 </form>;
}
