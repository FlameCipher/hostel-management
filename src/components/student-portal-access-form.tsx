"use client";
import { useActionState } from "react";
import { setStudentPortalAccessAction, type PortalAccessState } from "@/app/(app)/students/actions";
const initial: PortalAccessState={error:""};
export function StudentPortalAccessForm({studentId}:{studentId:string}){
 const action=setStudentPortalAccessAction.bind(null,studentId);
 const [state,formAction,pending]=useActionState(action,initial);
 return <form action={formAction} className="entity-form"><label className="field-group"><span>New portal password *</span><input name="portalPassword" type="password" minLength={10} maxLength={128} autoComplete="new-password" required/></label>{state.error?<p className="form-error">{state.error}</p>:null}{state.success?<p className="form-success">{state.success}</p>:null}<button className="primary-button" disabled={pending}>{pending?"Saving…":"Enable / reset portal access"}</button></form>
}
