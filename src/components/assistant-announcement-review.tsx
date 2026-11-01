"use client";
import { useActionState, useState, type FormEvent } from "react";
import Link from "next/link";
import { publishAction } from "@/app/(app)/communications/actions";
import type { AnnouncementDraft } from "@/lib/assistant-announcement";

export function AssistantAnnouncementReview({draft,onClose}:{draft:AnnouncementDraft;onClose:()=>void}) {
 const [state,action,pending]=useActionState(publishAction,{});
 const [title,setTitle]=useState(draft.title),[body,setBody]=useState(draft.body);
 const [email,setEmail]=useState(false),[whatsapp,setWhatsapp]=useState(false);
 const [publishAt,setPublishAt]=useState("");
 const [review,setReview]=useState<null|{title:string;body:string;email:boolean;whatsapp:boolean;publishAt:string}>(null);
 const [approved,setApproved]=useState(false);
 const [error,setError]=useState("");
 const changed=()=>{setReview(null);setApproved(false);setError("");};
 function prepareReview(){
  if(title.trim().length<3||title.trim().length>160||body.trim().length<10||body.trim().length>3000){
   setError("Enter a subject and message within the supported length before reviewing.");return;
  }
  if(draft.recipientCount===0){setError("No current eligible tenants were found. No notice can be published.");return;}
  if(email&&draft.emailCount===0){setError("No eligible tenant email addresses are recorded. Turn off email copies or update student emails first.");return;}
  if(whatsapp&&draft.whatsappOptInCount===0){setError("No tenant WhatsApp opt-in is currently recorded. Turn off WhatsApp copies until eligible permission has been verified.");return;}
  setError("");setApproved(false);setReview({title:title.trim(),body:body.trim(),email,whatsapp,publishAt});
 }
 function guard(event:FormEvent<HTMLFormElement>){
  if(!review||!approved||pending||state.success){
   event.preventDefault();setError("Review the current message and explicitly approve it before publishing.");return;
  }
  if(review.title!==title.trim()||review.body!==body.trim()||review.email!==email||review.whatsapp!==whatsapp||review.publishAt!==publishAt){
   event.preventDefault();changed();setError("The message changed after review. Review it again before publishing.");
  }
 }
 return <section className="panel entity-form mt-4" aria-label="Review hostel broadcast before publication" id="assistant-announcement-review">
  <div className="page-heading-row"><div>
   <p className="eyebrow">AI Communications Desk · Approval required</p>
   <h2>Urgent student announcement</h2>
   <p>Prepare, review and confirm. No communication has been sent by the AI.</p>
  </div><button type="button" className="secondary-button" disabled={pending} onClick={onClose}>Close</button></div>
  <div className="form-grid">
   <div><strong>{draft.recipientCount}</strong><small> Current eligible hostel tenants</small></div>
   <div><strong>{draft.portalEnabledCount}</strong><small> Have activated portal access</small></div>
   <div><strong>{draft.emailCount}</strong><small> Have a recorded email address</small></div>
   <div><strong>{draft.whatsappOptInCount}</strong><small> Recorded WhatsApp opt-ins (not proof of delivery)</small></div>
  </div>
  {draft.updateLink?<p className="muted-note">Verified hostel account-update link: <a href={draft.updateLink} target="_blank" rel="noreferrer">{draft.updateLink}</a></p>:null}
  <form action={action} onSubmit={guard} className="entity-form">
   <input type="hidden" name="requestId" value={draft.requestId}/>
   <input type="hidden" name="category" value={draft.category}/>
   <input type="hidden" name="audience" value="ALL"/>
   <input type="hidden" name="expectedRecipientCount" value={draft.recipientCount}/>
   {draft.recipientIds.map(id=><input type="hidden" key={id} name="reviewedStudentIds" value={id}/>)}
   <label className="field-group"><span>Announcement title *</span>
    <input required minLength={3} maxLength={160} name="title" value={title} onChange={e=>{setTitle(e.target.value);changed();}}/>
   </label>
   <label className="field-group"><span>Message to all current hostel tenants *</span>
    <textarea name="body" value={body} onChange={e=>{setBody(e.target.value);changed();}} rows={9} minLength={10} maxLength={3000} required/>
   </label>
   <label className="field-group"><span>Publish at (Nairobi time; optional)</span>
    <input type="datetime-local" name="publishAt" value={publishAt} onChange={e=>{setPublishAt(e.target.value);changed();}}/>
   </label>
   <label className="check-field"><input name="email" type="checkbox" checked={email} onChange={e=>{setEmail(e.target.checked);changed();}}/>
    Request individual email copies for eligible students ({draft.emailCount} recorded email addresses). Delivery is processed separately.
   </label>
   <label className="check-field"><input name="whatsapp" type="checkbox" checked={whatsapp} onChange={e=>{setWhatsapp(e.target.checked);changed();}}/>
    Prepare WhatsApp copies. Automatic delivery requires consent, verified Business sender and webhook; otherwise delivery remains manual.
   </label>
   <p className="muted-note">A private portal notice will be created for all eligible current tenants after approval. Only {draft.portalEnabledCount} currently have activated portal access to read it; others require account activation. This is not an SMS blast, WhatsApp group or proof of WhatsApp/email delivery. Students outside the current tenant audience are not included.</p>
   {review?<div className="panel" role="region" aria-label="Announcement approval preview" style={{padding:14}}>
    <h3>Confirm before publishing</h3>
    <p><strong>{review.title}</strong></p>
    <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{review.body}</p>
    <p><strong>Recipients:</strong> {draft.recipientCount} current tenants</p>
    <p><strong>Channels:</strong> Private portal{review.email?", requested email copies":""}{review.whatsapp?", WhatsApp copy preparation":""}</p>
    <p><strong>Timing:</strong> {review.publishAt?"Scheduled, Nairobi time "+review.publishAt:"Publish immediately"}</p>
    <label className="check-field"><input type="checkbox" name="confirmed" checked={approved} onChange={e=>setApproved(e.target.checked)}/>
     I have reviewed the exact notice, audience, links and channels and explicitly authorize publication to all eligible current tenants.
    </label>
   </div>:null}
   {(error||state.error)?<p className="form-error" role="alert">{error||state.error}</p>:null}
   {state.success?<p className="form-success" role="status">{state.success} Email/WhatsApp provider delivery must be checked separately in the communication centre.</p>:null}
   <div className="form-actions">
    {review&&!state.success?<button className="secondary-button" type="button" disabled={pending} onClick={changed}>Edit / review again</button>:null}
    {!review&&!state.success?<button className="primary-button" type="button" disabled={pending||draft.recipientCount===0} onClick={prepareReview}>Review announcement</button>:null}
    {review&&!state.success?<button className="primary-button" type="submit" disabled={!approved||pending}>{pending?"Publishing…":"Confirm and publish to current tenants"}</button>:null}
    {state.success?<Link className="secondary-button" href="/communications">Verify saved notice and delivery status</Link>:null}
   </div>
  </form>
 </section>;
}
