"use client";
import { useEffect,useState } from "react";
import styles from "./account-security.module.css";
export function WhatsAppPreferences({tenant=false}:{tenant?:boolean}){
 const [enabled,setEnabled]=useState(false),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);const path=`/api/whatsapp/preferences?audience=${tenant?"tenant":"staff"}`;
 useEffect(()=>{let active=true;fetch(path).then(r=>r.json()).then(r=>{if(active){if(r.error)setMessage(r.error);else{setEnabled(r.enabled);setReady(true);}}}).catch(()=>{if(active)setMessage("Preferences could not load. Refresh to try again.");});return()=>{active=false;};},[path]);
 async function save(){setBusy(true);try{const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:!enabled})});const result=await r.json();if(!r.ok)throw Error(result.error);setEnabled(result.enabled);setMessage(result.enabled?"Preference saved. Delivery starts when your hostel connects its approved WhatsApp sender.":"Automatic WhatsApp messages are turned off for your account.");}catch(error){setMessage(error instanceof Error?error.message:"Preference could not be saved.");}finally{setBusy(false);}}
 return <section className={styles.connection}><h2>WhatsApp preferences</h2><p>I agree to receive hostel messages, reminders, invitations and receipt links on WhatsApp at my registered phone number. I can turn this off at any time.</p><button className="secondary-button" disabled={!ready||busy} onClick={()=>void save()}>{busy?"Saving…":enabled?"Turn off WhatsApp updates":"Agree and enable WhatsApp updates"}</button>{message&&<p role="status">{message}</p>}</section>;
}
