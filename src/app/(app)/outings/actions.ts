"use server";
import {revalidatePath} from "next/cache";
import {requireSession} from "@/lib/auth/session";
import {db} from "@/lib/db";
import {recordStaffOutingResponse} from "@/lib/student-outings";
export type GateOutingState={success?:string;error?:string};
export async function gateOutingAction(_state:GateOutingState,form:FormData):Promise<GateOutingState>{
 const session=await requireSession();
 try {
  const result=await recordStaffOutingResponse(db,session,{
   id:form.get("id"),action:form.get("action"),
   verified:form.get("verified")==="on",note:form.get("note"),
  });
  revalidatePath("/outings");revalidatePath("/tenant/movements");revalidatePath("/dashboard");
  return result;
 }catch{return {error:"Gate update could not be confirmed. Refresh and verify the entry before trying again."};}
}
