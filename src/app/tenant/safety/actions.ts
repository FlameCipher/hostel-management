"use server";
import { revalidatePath } from "next/cache";
import { requireTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";
import { submitSOS } from "@/lib/student-safety";

export async function sendStudentSOS(input:unknown){
 const session=await requireTenantSession();
 try {
   const result=await submitSOS(db,session,input);
   revalidatePath("/tenant/safety");
   revalidatePath("/safety");
   return result;
 } catch {
   return {error:"The system could not confirm your SOS. Call 999 or 112 now if you are in danger, and contact someone you trust."};
 }
}
