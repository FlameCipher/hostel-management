"use client";
import {useActionState,useEffect} from "react";
import {useRouter} from "next/navigation";
import {studentMovementAction} from "@/app/tenant/movements/actions";

type Current={id:string;status:string;expectedReturnAt:string;lateNotifiedAt:string|null};

function MovementForm({children}:{children:React.ReactNode}){
 return <div>{children}</div>;
}
function OutboundForm({requestId,timeZone}:{requestId:string;timeZone:string}){
 const [state,action,pending]=useActionState(studentMovementAction,{});
 const router=useRouter();
 useEffect(()=>{if(state.success)router.refresh();},[state.success,router]);
 return <form action={action} className="panel entity-form">
  <h2>Going out</h2>
  <p>Let hostel security know you intend to leave and when you expect to return.
    Your report is voluntary; it is not GPS tracking or an observed gate departure.</p>
  <input name="action" type="hidden" value="GO_OUT"/>
  <input name="requestId" type="hidden" value={requestId}/>
  <label className="field-group"><span>Expected return time (hostel time: {timeZone}) *</span>
    <input type="datetime-local" name="expectedReturnLocal" required/>
  </label>
  <button className="primary-button" disabled={pending}>
    {pending?"Saving…":"Report going out"}
  </button>
  {state.error?<p className="form-error" role="alert">{state.error}</p>:null}
  {state.success?<p className="form-success" role="status">{state.success}</p>:null}
 </form>;
}
function LateForm({current,timeZone}:{current:Current;timeZone:string}){
 const [state,action,pending]=useActionState(studentMovementAction,{});
 const router=useRouter();
 useEffect(()=>{if(state.success)router.refresh();},[state.success,router]);
 return <form action={action} className="panel entity-form">
   <h2>I'll be late</h2>
   <p>Request a later return time so hostel security can plan coverage.
      This notice does not automatically authorize late access or guarantee that an officer is waiting.</p>
   <input name="action" type="hidden" value="REPORT_LATE"/>
   <input name="outingId" type="hidden" value={current.id}/>
   <label className="field-group"><span>New expected return (hostel time: {timeZone}) *</span>
     <input name="expectedReturnLocal" type="datetime-local" required/>
   </label>
   <label className="field-group"><span>Reason or short note (optional)</span>
     <textarea name="note" rows={2} maxLength={180} placeholder="I have evening classes and may reach the gate later."/>
   </label>
   <button className="primary-button" disabled={pending}>{pending?"Saving…":"Send late-return notice"}</button>
   {state.error?<p className="form-error" role="alert">{state.error}</p>:null}
   {state.success?<p className="form-success" role="status">{state.success}</p>:null}
 </form>;
}
function ReturnForm({id}:{id:string}){
 const [state,action,pending]=useActionState(studentMovementAction,{});
 const router=useRouter();
 useEffect(()=>{if(state.success)router.refresh();},[state.success,router]);
 return <form action={action} className="panel entity-form">
   <h2>I'm back at the hostel</h2>
   <p>Only press this after actually reaching the hostel. An authorized officer
     must separately verify your return at the gate.</p>
   <input name="action" type="hidden" value="REPORT_RETURN"/>
   <input name="outingId" type="hidden" value={id}/>
   <button className="primary-button" disabled={pending}>{pending?"Saving…":"Report that I returned"}</button>
   {state.error?<p className="form-error" role="alert">{state.error}</p>:null}
   {state.success?<p className="form-success" role="status">{state.success}</p>:null}
 </form>;
}
export function StudentMovementForms({current,requestId,timeZone}:{
 current:Current|null;requestId:string;timeZone:string
}){
 return <div className="entity-form">
   {!current?<OutboundForm requestId={requestId} timeZone={timeZone}/>:
    current.status==="OUT"?<>
      <LateForm current={current} timeZone={timeZone}/>
      <ReturnForm id={current.id}/>
    </>:<section className="panel entity-form">
      <h2>Return reported — awaiting gate verification</h2>
      <p>Your update is saved, but security has not independently confirmed entry.
         Ask the on-duty officer to verify your actual return before reporting another outing.</p>
    </section>}
 </div>;
}
