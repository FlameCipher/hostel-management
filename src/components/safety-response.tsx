"use client";
import { useActionState } from "react";
import { staffSOSAction } from "@/app/(app)/safety/actions";

export function SafetyResponseForm({id,status,canClose}:{
 id:string;status:string;canClose:boolean
}){
 const [result,action,pending]=useActionState(staffSOSAction,{});
 return <form action={action} className="entity-form">
   <input type="hidden" name="id" value={id}/>
   <label className="field-group"><span>Follow-up note</span>
     <textarea name="note" required minLength={10} maxLength={500} rows={2}/>
   </label>
   <label className="check-field"><input name="verified" type="checkbox" required/>
     I performed the response described in this note.
   </label>
   <div className="heading-actions">
     {status==="OPEN"?<button className="primary-button" name="decision" value="ACKNOWLEDGE" disabled={pending}>Record acknowledgement</button>:null}
     {canClose?<button className="secondary-button" name="decision" value="CLOSE" disabled={pending}>Close incident record</button>:null}
   </div>
   {result.error?<p className="form-error" role="alert">{result.error}</p>:null}
   {result.success?<p className="form-success" role="status">{result.success}</p>:null}
 </form>;
}
