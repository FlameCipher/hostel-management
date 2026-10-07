"use server";
import { db } from "@/lib/db";
import { activateInvitation } from "@/lib/portal-invitations";
export type ActivationState={error?:string;success?:string};
export async function activateAction(_state:ActivationState,f:FormData):Promise<ActivationState>{
 try{return await activateInvitation(db,{token:f.get("token"),password:f.get("password"),confirmation:f.get("confirmation")});}catch{return{error:"Activation could not be confirmed. Try signing in or contact management."};}
}
