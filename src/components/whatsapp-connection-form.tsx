"use client";
import { useActionState } from "react";
import { saveWhatsAppConnection } from "@/app/(app)/communications/whatsapp/connection-actions";
import { PasswordInput } from "./password-input";
import styles from "./account-security.module.css";
export function WhatsAppConnectionForm({connection}:{connection:{displayPhone:string;enabled:boolean;templateName:string}|null}){
 const [state,action,pending]=useActionState(saveWhatsAppConnection,{});
 return <section className={styles.card}><h2>Automatic business sender</h2><p className={styles.note}>{connection?`${connection.displayPhone} · ${connection.enabled?"Automatic delivery enabled":"Paused"}`:"Connect this hostel's approved WhatsApp Business Platform sender."}</p><p className={styles.note}>Meta must approve a text template with one body variable, such as “Hostel update: {'{{1}}'}”. Use an appropriate utility template for the messages you send. Recipients must enable WhatsApp updates in their accounts. Older drafts are kept for manual review.</p><form action={action} className={styles.fields}>
 {[['phoneNumberId','Phone number ID'],['businessAccountId','WhatsApp Business Account ID'],['apiVersion','Meta API version (for example v26.0)'],['templateName','Approved template name'],['templateLanguage','Template language (for example en)']].map(([name,label])=><label className={styles.field} key={name}><span>{label}</span><input className={styles.input} name={name} required maxLength={128} autoComplete="off"/></label>)}
 <label className={styles.field}><span>Business access token</span><PasswordInput className={styles.input} name="accessToken" required maxLength={4096} autoComplete="off"/></label>
 <label className={styles.confirmation}><input type="checkbox" name="enabled"/><span>Enable automatic sending for future eligible messages. Meta messaging charges may apply.</span></label><button className={styles.submit} disabled={pending}>{pending?"Verifying…":"Verify and save sender"}</button></form>
 {connection&&<form action={action}><input type="hidden" name="pause" value="true"/><button className="secondary-button" disabled={pending}>Pause automatic sending</button></form>}{state.error&&<p className={styles.error} role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}</section>;
}
