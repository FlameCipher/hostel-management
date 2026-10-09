"use client";
import { useEffect,useState } from "react";
import styles from "./account-security.module.css";
export function PushSettings({tenant=false}:{tenant?:boolean}){
 const [state,setState]=useState<{configured:boolean;publicKey:string|null;enabled:boolean}|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const path=`/api/push?audience=${tenant?"tenant":"staff"}`;
 useEffect(()=>{let alive=true;fetch(path).then(r=>r.json()).then(r=>{if(alive){if(r.error)setMessage(r.error);else setState(r);}}).catch(()=>{if(alive)setMessage("Notification settings could not load. Refresh to try again.");});return()=>{alive=false;};},[path]);
 async function change(enable:boolean){
  setBusy(true);setMessage("");
  try{
   if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window))throw Error("This browser does not support device notifications. On iPhone or iPad, install the app from Safari and open its Home Screen icon first.");
   if(enable&&await Notification.requestPermission()!=="granted")throw Error("Notifications are blocked. Allow them in your browser or phone settings, then try again.");
   const registration=await navigator.serviceWorker.register("/hostel-sw.js",{scope:"/",updateViaCache:"none"});await navigator.serviceWorker.ready;
   let sub=await registration.pushManager.getSubscription();
   if(enable){const key=state?.publicKey;if(!key)throw Error("Notifications are not configured yet.");const bytes=Uint8Array.from(atob(key.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));sub??=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(sub.toJSON())});const result=await response.json();if(!response.ok){if(response.status===409){await sub.unsubscribe();throw Error("This device was linked to another account. Select Enable again to create your own subscription.");}throw Error(result.error||"Unable to enable notifications.");}}
   else{const response=await fetch(path,{method:"DELETE"});if(!response.ok)throw Error("Unable to disable notifications. Please try again.");await sub?.unsubscribe();}
   setState(s=>s?{...s,enabled:enable}:s);setMessage(enable?"Notifications are enabled on this device. Your phone controls whether and when alerts appear.":"Notifications are disabled on this device.");
  }catch(error){setMessage(error instanceof Error?error.message:"Notification settings could not be saved.");}finally{setBusy(false);}
 }
 return <section className={styles.connection} aria-labelledby="push-title"><h2 id="push-title">Device notifications</h2><p>Get a private alert for new messages and visitor activity, even when the app is closed. Lock-screen alerts do not show names, balances or message contents.</p><p>On iPhone or iPad, first install this hostel app from Safari and open its Home Screen icon.</p><button className="secondary-button" disabled={busy||!state?.configured} onClick={()=>void change(!state?.enabled)}>{busy?"Updating…":state?.enabled?"Turn off on this device":"Enable on this device"}</button>{state&&!state.configured&&<p>Notifications are awaiting service configuration.</p>}{message&&<p role="status">{message}</p>}</section>;
}
