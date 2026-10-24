"use client";
import { useActionState, useState } from "react";
import { saveWhatsAppConnection } from "@/app/(app)/communications/whatsapp/connection-actions";
import { PasswordInput } from "./password-input";
import styles from "./account-security.module.css";

type SavedSender = { displayPhone:string; enabled:boolean; templateName:string } | null;
type Props = { connection:SavedSender; webhookConfigured:boolean; hostelWebhookUrl?:string|null; centralSharedNumber?:boolean };

const fields = [
 { name:"phoneNumberId", label:"Meta Phone Number ID", hint:"Digits copied from Meta's WhatsApp API Setup — NOT your mobile number", numeric:true },
 { name:"businessAccountId", label:"WhatsApp Business Account (WABA) ID", hint:"Meta's WhatsApp Account ID, not your Business Portfolio ID", numeric:true },
 { name:"apiVersion", label:"Graph API version", hint:"Use the supported version shown by Meta (for example v26.0)" },
 { name:"templateName", label:"Approved utility template name", hint:"Exact approved template name using one body variable: {{1}}" },
 { name:"templateLanguage", label:"Template language", hint:"Use the approved language code, e.g. en" },
] as const;

export function WhatsAppConnectionForm({connection,webhookConfigured,hostelWebhookUrl,centralSharedNumber=false}:Props) {
 const [state,action,pending]=useActionState(saveWhatsAppConnection,{});
 const [copied,setCopied]=useState("");
 async function copyWebhook() {
  if(!hostelWebhookUrl)return;
  try {
   await navigator.clipboard.writeText(hostelWebhookUrl);
   setCopied("Webhook URL copied. The matching verify token must still be configured privately by the platform administrator.");
  }catch{setCopied("Copy the displayed public webhook URL manually. Never share the webhook verification secret.");}
 }
 return <section className={styles.card} aria-label="WhatsApp Business Cloud API setup">
  <h2>Automatic WhatsApp messages — connect Meta</h2>
  <p className={styles.note}>{connection
    ? `Verified number: ${connection.displayPhone} · ${connection.enabled?"Automatic sender enabled":"Automatic sending paused"}`
    : "Not connected. Your WhatsApp Business phone app does not by itself activate automated sending."}</p>
  <p className={styles.note}>Complete these steps in order. Do not put your normal phone number into the Phone Number ID field or paste your secret token into a chat.</p>
  <ol style={{display:"grid",gap:12,paddingLeft:22,margin:"14px 0"}}>
   <li><strong>Connect the actual sender in Meta.</strong> Open <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">Meta for Developers</a>, choose your business app and find WhatsApp → API Setup. If your existing number is still used in the WhatsApp Business app, first confirm that you can use the supported app/API coexistence signup. Do not deregister or delete the app to make a test connection.</li>
   <li><strong>Collect the IDs.</strong> Select the correct production business number, then copy its numeric Phone Number ID and WhatsApp Business Account ID. They are different IDs. A test number will not automatically configure your real sender.</li>
   <li><strong>Prepare an approved template and secure token.</strong> In <a href="https://business.facebook.com/settings/" target="_blank" rel="noopener noreferrer">Meta Business Settings</a>, assign the appropriate WhatsApp assets to a system user and generate a production token with <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code>. In WhatsApp Manager, approve a suitable utility template with one text body placeholder (<code>{"{{1}}"}</code>) and record its name and language.</li>
   <li><strong>Verify the webhook and consent.</strong> The platform must configure the Meta App Secret and webhook verify token privately. Individual students or staff must agree to WhatsApp updates before any automatic messages are sent.</li>
  </ol>
  {centralSharedNumber&&<p className={styles.note}><strong>Shared business number:</strong> 0726 717 120 is intended for more than one business. This hostel form verifies a sender for this hostel only; it does not yet prove that messages are safely routed among your other businesses. Do not register the same phone across different hostel accounts or send business-wide notices until routing is verified.</p>}
  <p className={styles.note}><strong>Webhook configuration:</strong> {webhookConfigured?"Meta webhook environment settings are present; real callbacks are not yet proven.":"Not complete. A sender may be saved with automatic sending paused, but sending must stay OFF until webhook settings and callbacks are verified."}</p>
  {hostelWebhookUrl&&<div style={{display:"grid",gap:8}}>
   <label className={styles.field}><span>Public callback URL for the Meta webhook (not a secret)</span><input className={styles.input} readOnly value={hostelWebhookUrl}/></label>
   <button type="button" className="secondary-button" onClick={()=>void copyWebhook()}>Copy webhook URL</button>
   {copied&&<p role="status" className={styles.note}>{copied}</p>}
  </div>}
  <details open={Boolean(state.error)} style={{marginTop:16}}>
   <summary style={{cursor:"pointer",fontWeight:650,padding:"12px 0"}}>I have the Meta IDs, approved template and token — open secure connection form</summary>
   <form action={action} className={styles.fields} style={{marginTop:12}}>
    {fields.map(f=><label className={styles.field} key={f.name}>
     <span>{f.label}</span>
     <input className={styles.input} name={f.name} required maxLength={128} autoComplete="off" inputMode={"numeric" in f ? "numeric" : "text"} placeholder={f.name==="apiVersion"?"e.g. v26.0":f.name==="templateLanguage"?"e.g. en":undefined}/>
     <small className={styles.note}>{f.hint}</small>
    </label>)}
    <label className={styles.field}><span>Secret business access token</span>
     <PasswordInput className={styles.input} name="accessToken" required maxLength={4096} autoComplete="off"/>
     <small className={styles.note}>Paste this only into the hostel's secure form. This is not the Meta App Secret. It is encrypted on save and never displayed back to you.</small>
    </label>
    <label className={styles.confirmation}><input type="checkbox" name="enabled" disabled={!webhookConfigured}/><span>Enable automatic sending <strong>only after</strong> webhook tests and recipient permissions. Leave unchecked when first connecting. Meta charges may apply.</span></label>
    <button className={styles.submit} disabled={pending}>{pending?"Verifying with Meta…":"Verify Meta details and save (paused by default)"}</button>
   </form>
  </details>
  {connection&&<form action={action}><input type="hidden" name="pause" value="true"/><button className="secondary-button" disabled={pending}>Pause automatic sending</button></form>}
  {state.error&&<p className={styles.error} role="alert">{state.error}</p>}
  {state.success&&<p role="status">{state.success}</p>}
 </section>;
}
