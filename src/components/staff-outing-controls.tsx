"use client";
import {useActionState,useEffect} from "react";
import {useRouter} from "next/navigation";
import {gateOutingAction} from "@/app/(app)/outings/actions";
type Props={id:string;status:string;lateNotifiedAt:boolean;lateAcknowledgedAt:boolean};

export function StaffOutingControls({id,status,lateNotifiedAt,lateAcknowledgedAt}:Props){
 const [state,action,pending]=useActionState(gateOutingAction,{});
 const router=useRouter();
 useEffect(()=>{if(state.success)router.refresh();},[state.success,router]);
 const lateCanAck=status==="OUT"&&lateNotifiedAt&&!lateAcknowledgedAt;
 const returnCanVerify=status==="RETURN_REPORTED";
 if(!lateCanAck&&!returnCanVerify)return null;
 return <form action={action} className="entity-form">
   <input name="id" type="hidden" value={id}/>
   <label className="field-group"><span>What you actually checked or did *</span>
     <textarea name="note" required minLength={10} maxLength={400} rows={2}
       placeholder={returnCanVerify?"I personally saw the student and verified their return at the gate.":"I saw the late notice and contacted the student about security access arrangements."}/>
   </label>
   <label className="check-field">
     <input name="verified" type="checkbox" required/>
     I personally performed the verification or action described. I am not guessing from a status.
   </label>
   <div className="heading-actions">
     {lateCanAck?<button name="action" value="ACKNOWLEDGE_LATE" className="secondary-button" disabled={pending}>
       Record review of late notice
     </button>:null}
     {returnCanVerify?<button name="action" value="VERIFY_RETURN" className="primary-button" disabled={pending}>
       Confirm actual gate return
     </button>:null}
   </div>
   {state.error?<p role="alert" className="form-error">{state.error}</p>:null}
   {state.success?<p role="status" className="form-success">{state.success}</p>:null}
 </form>;
}
