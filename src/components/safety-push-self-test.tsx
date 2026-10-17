"use client";
import {useState} from "react";
export function SafetyPushSelfTest(){
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 async function requestTest(){
   if(busy)return;
   setBusy(true);setMessage("");
   try{
     const response=await fetch("/api/push/safety-test",{
       method:"POST",credentials:"same-origin",cache:"no-store",
     });
     const data=await response.json() as {error?:string;success?:string};
     setMessage(response.ok?data.success??"TEST queued.":data.error??"TEST unavailable.");
   }catch{
     setMessage("This test could not be queued. Check connection and contact management.");
   }finally{setBusy(false);}
 }
 return <section className="panel entity-form mt-5" aria-label="Staff device notification test">
   <h3>Test notifications on this phone</h3>
   <p>Once you enable staff notifications above, you can send a clearly labelled
     TEST to this signed-in phone. It uses the same scheduled push worker as SOS
     notices, but does not create an incident or notify other staff or students.</p>
   <button type="button" className="secondary-button" disabled={busy}
     onClick={()=>void requestTest()}>{busy?"Preparing TEST…":"Send TEST notification to this phone"}</button>
   {message?<p role="status">{message}</p>:null}
   <p className="muted-note">The worker may take several minutes.
     TEST queued or provider accepted does not prove it was displayed.
     Confirm receipt yourself. An actual emergency response still needs a trained staff member and direct calling.</p>
 </section>;
}
