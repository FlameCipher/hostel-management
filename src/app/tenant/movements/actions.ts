"use server";
import {revalidatePath} from "next/cache";
import {requireTenantSession} from "@/lib/auth/tenant-session";
import {db} from "@/lib/db";
import {reportStudentOuting} from "@/lib/student-outings";
export type MovementActionState={success?:string;error?:string};
export async function studentMovementAction(_state:MovementActionState,form:FormData):Promise<MovementActionState>{
 const session=await requireTenantSession();
 try{
   const result=await reportStudentOuting(db,session,{
     action:form.get("action"),requestId:form.get("requestId")||undefined,
     outingId:form.get("outingId")||undefined,
     expectedReturnLocal:form.get("expectedReturnLocal")||undefined,
     note:form.get("note")??"",
   });
   revalidatePath("/tenant/movements");revalidatePath("/outings");revalidatePath("/dashboard");
   return result;
 }catch{return {error:"Could not confirm the update. Check the latest status before retrying, and call security if urgent."};}
}
