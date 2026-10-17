"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { updateSOS } from "@/lib/student-safety";

export async function staffSOSAction(_state:{error?:string;success?:string},form:FormData){
 const session=await requireSession();
 try {
   const result=await updateSOS(db,session,{
      id:form.get("id"),decision:form.get("decision"),
      verified:form.get("verified")==="on",note:form.get("note"),
   });
   revalidatePath("/safety");
   revalidatePath("/tenant/safety");
   return result;
 } catch {
   return {error:"This response could not be confirmed. Refresh the SOS register before retrying."};
 }
}
