"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { recordEmergencyCallTest } from "@/lib/emergency-call-acceptance";

export type EmergencyCallTestState={error?:string;success?:string};
export async function recordEmergencyCallTestAction(
 _state:EmergencyCallTestState,form:FormData
):Promise<EmergencyCallTestState>{
 const session=await requireSession();
 try{
  const result=await recordEmergencyCallTest(db,session,{
   line:form.get("line"),
   result:form.get("result"),
   note:form.get("note"),
   personallyTested:form.get("personallyTested")==="on",
  });
  if(result.success)revalidatePath("/gate-readiness");
  return result;
 }catch{return {error:"This call test could not be confirmed in the audit log. Check the history before retrying."};}
}
