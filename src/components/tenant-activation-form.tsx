"use client";
import { useActionState } from "react";
import Link from "next/link";
import { activateAction } from "@/app/tenant/activate/[token]/actions";
export function TenantActivationForm({token}:{token:string}){
 const [state,action,pending]=useActionState(activateAction,{});
 if(state.success)return <section className="panel entity-form"><p className="form-success" role="status">{state.success}</p><Link className="primary-button" href="/tenant/login">Sign in to my account</Link></section>;
 return <form action={action} className="panel entity-form"><input name="token" type="hidden" value={token}/><label className="field-group"><span>Choose your password</span><input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/></label><label className="field-group"><span>Confirm password</span><input name="confirmation" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/></label><p>Your account gives you access to your hostel rules, statement, notices and private conversations with management. You will accept the accommodation terms separately after signing in.</p>{state.error?<p role="alert" className="form-error">{state.error}</p>:null}<button className="primary-button" disabled={pending}>{pending?"Creating account…":"Create my tenant account"}</button></form>;
}
