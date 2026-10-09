"use server";
import { requestPropertyContext } from "@/lib/property-host";
import { db } from "@/lib/db";
import { activateInvitation } from "@/lib/portal-invitations";
export type ActivationState={error?:string;success?:string};
export async function activateAction(_state:ActivationState,f:FormData):Promise<ActivationState>{
 const context = await requestPropertyContext();
 if (!context.property) return {error:"Open the invitation on your hostel’s own website."};
 try{return await activateInvitation(db,{token:f.get("token"),password:f.get("password"),confirmation:f.get("confirmation")}, context.host);}catch{return{error:"Activation could not be confirmed. Try signing in or contact management."};}
}
