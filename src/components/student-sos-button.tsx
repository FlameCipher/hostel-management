"use client";
import { useState } from "react";
import { sendStudentSOS } from "@/app/tenant/safety/actions";

type Result={success?:string;error?:string};
type Coordinates={latitude:number;longitude:number;accuracyMeters:number};

export function StudentSOSButton({requestId}:{requestId:string}){
 const [share,setShare]=useState(false);
 const [note,setNote]=useState("");
 const [sending,setSending]=useState(false);
 const [result,setResult]=useState<Result>({});
 const [locationOutcome,setLocationOutcome]=useState("");
 const [submitted,setSubmitted]=useState(false);
 async function sendSOS(){
   if(sending||submitted)return;
   setSending(true);
   setResult({});
   setLocationOutcome("");
   let coordinates:Coordinates|null=null;
   if(share){
     if(typeof navigator!=="undefined" && "geolocation" in navigator){
       coordinates=await new Promise<Coordinates|null>(resolve=>{
         navigator.geolocation.getCurrentPosition(
           p=>{
             const {latitude,longitude,accuracy}=p.coords;
             resolve(Number.isFinite(latitude)&&Number.isFinite(longitude)&&
               latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180&&
               Number.isFinite(accuracy)&&accuracy>=0&&accuracy<=50000
               ?{latitude,longitude,accuracyMeters:accuracy}:null);
           },
           ()=>resolve(null),
           {enableHighAccuracy:true,maximumAge:0,timeout:4500},
         );
       });
       if(!coordinates)setLocationOutcome("Location could not be obtained; sending SOS without coordinates.");
     }else setLocationOutcome("Location is unavailable on this device; sending SOS without coordinates.");
   }
   try{
     const response=await sendStudentSOS({
       requestId,note,shareLocation:share,
       latitude:coordinates?.latitude??null,
       longitude:coordinates?.longitude??null,
       accuracyMeters:coordinates?.accuracyMeters??null,
     });
     setResult(response);
     if(response.success)setSubmitted(true);
   }catch{
     setResult({error:"SOS could not be confirmed. Call 999 or 112 for urgent police, fire or ambulance help."});
   }finally{setSending(false);}
 }
 return <section className="panel entity-form" aria-label="Emergency SOS">
   <h2>Emergency SOS — request help</h2>
   <p>If you are threatened, being followed, attacked or feel unsafe, use this button to create an SOS for authorized hostel staff.</p>
   <p><strong>For immediate emergency services, call <a href="tel:999">999</a> or <a href="tel:112">112</a>.</strong> The hostel app does not contact the police for you.</p>
   <label className="field-group"><span>Details (optional)</span>
     <textarea rows={2} maxLength={240} value={note} onChange={e=>setNote(e.target.value)}
       disabled={sending||submitted} placeholder="For example: I am near Gate B and need help. Only type if it is safe."/>
   </label>
   <label className="check-field">
     <input type="checkbox" checked={share} onChange={e=>setShare(e.target.checked)} disabled={sending||submitted}/>
     <span>Share my current location <strong>once</strong> with hostel responders for this SOS.</span>
   </label>
   <p className="policy-note">Location sharing is optional and requests permission from your device. No ongoing GPS tracking takes place. If location fails, SOS is submitted without it. A saved alert is not proof that staff have seen it.</p>
   <button type="button" onClick={sendSOS} disabled={sending||submitted}
     style={{backgroundColor:"#b91c1c",color:"#ffffff",borderRadius:"0.85rem",padding:"1.1rem",fontSize:"1.15rem",fontWeight:700,width:"100%",minHeight:62}}>
     {submitted?"SOS REQUEST RECORDED":sending?"SENDING SOS…":"SOS — I NEED HELP"}
   </button>
   {locationOutcome?<p role="status">{locationOutcome}</p>:null}
   {result.success?<p role="status" className="form-success"><strong>{result.success}</strong></p>:null}
   {result.error?<p role="alert" className="form-error"><strong>{result.error}</strong></p>:null}
   <p className="muted-note">This is a student-initiated incident report, not 24-hour location surveillance or guaranteed emergency dispatch. If no confirmation appears, use emergency phone services.</p>
 </section>;
}
