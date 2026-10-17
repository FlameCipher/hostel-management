"use client";
import {useEffect,useState} from "react";

type Setup={configured:boolean;publicKey:string|null;enabled:boolean;error?:string};
function vapidBytes(value:string):ArrayBuffer {
 const padded=(value.replace(/-/g,"+").replace(/_/g,"/")+"===").slice(0,
  Math.ceil(value.length/4)*4);
 const binary=atob(padded),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes.buffer;
}
export function DeviceReminderOptIn({audience="tenant"}:{
 audience?:"tenant"|"staff"
}){
 const [state,setState]=useState<Setup|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const api="/api/push?audience="+audience;
 useEffect(()=>{
   const controller=new AbortController();
   void fetch(api,{cache:"no-store",signal:controller.signal})
     .then(async response=>{
       const data=await response.json() as Setup;
       if(!response.ok)throw Error(data.error||"Notification setup unavailable.");
       if(!controller.signal.aborted)setState(data);
     }).catch(()=>{
       if(!controller.signal.aborted)setMessage(
         "Device push is unavailable here. Open your own published hostel website and sign in."
       );
     });
   return ()=>controller.abort();
 },[api]);
 async function enable(){
   if(busy)return;
   setBusy(true);setMessage("");
   try{
     if(!state?.configured||!state.publicKey)throw Error(
       "Push notifications are not configured for this hostel yet.");
     if(!("Notification" in window)||!("serviceWorker" in navigator)||
       !window.isSecureContext)throw Error("Device push requires a supported secure browser.");
     const permission=await Notification.requestPermission();
     if(permission!=="granted")throw Error("You have not permitted device notifications.");
     const registration=await navigator.serviceWorker.register("/hostel-sw.js",{
       scope:"/",updateViaCache:"none"
     });
     const subscription=await registration.pushManager.subscribe({
       userVisibleOnly:true,applicationServerKey:vapidBytes(state.publicKey),
     });
     const data=subscription.toJSON();
     if(!data.endpoint||!data.keys?.p256dh||!data.keys.auth)
       throw Error("This device did not return a usable push subscription.");
     const response=await fetch(api,{
       method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({endpoint:data.endpoint,
         keys:{p256dh:data.keys.p256dh,auth:data.keys.auth}}),
     });
     const json=await response.json();
     if(!response.ok)throw Error(json.error||"Could not save your preference.");
     setState({...state,enabled:true});
     setMessage("Notification subscription saved. Provider delivery is not guaranteed.");
   }catch(error){
     setMessage(error instanceof Error?error.message:"Notifications could not be enabled.");
   }finally{setBusy(false);}
 }
 async function disable(){
   if(busy)return;
   setBusy(true);setMessage("");
   try{
     const response=await fetch(api,{method:"DELETE"});
     if(!response.ok)throw Error("Could not disable this device in the hostel register.");
     const registration=await navigator.serviceWorker.ready;
     const subscription=await registration.pushManager.getSubscription();
     if(subscription)await subscription.unsubscribe();
     setState(state?{...state,enabled:false}:null);
     setMessage("Device push disabled for this hostel account.");
   }catch(error){
     setMessage(error instanceof Error?error.message:"Could not disable notifications.");
   }finally{setBusy(false);}
 }
 return <section className="panel entity-form" aria-label="Optional device reminder setup">
   <h3>Optional device notifications</h3>
   <p>{audience==="tenant"?
     "Receive class reminders through your compatible hostel app when device push is enabled.":
     "Receive privacy-safe gate notifications for new late-return and self-reported arrival updates."}
     They are optional, depend on an internet connection and the configured provider,
     and cannot guarantee an alert was seen or a security officer is available.</p>
   {state?.configured?<>
     <p role="status">This device: <strong>{state.enabled?"Registered":"Not registered"}</strong></p>
     <div className="heading-actions">
       {!state.enabled?<button type="button" className="primary-button"
         disabled={busy} onClick={()=>void enable()}>
         {busy?"Enabling…":"Enable device notifications"}
       </button>:<button type="button" className="secondary-button"
         disabled={busy} onClick={()=>void disable()}>
         {busy?"Updating…":"Disable device notifications"}
       </button>}
     </div>
   </>:<p className="muted-note">Device notification provider is not ready or this is
      not the hostel's authorized, published app domain. The timetable and gate queues
      remain usable from within the website.</p>}
   {message?<p role="status">{message}</p>:null}
 </section>;
}
