"use server";
import { requireTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";
import { tenantWhere } from "@/lib/communications";
import { revalidatePath } from "next/cache";
export async function readMessageAction(form:FormData){
 const s=await requireTenantSession();
 const student=await db.student.findFirst({where:{...tenantWhere(s.organizationId),id:s.studentId,portalEnabled:true},select:{id:true}});if(!student)return;
 await db.tenantMessage.updateMany({where:{id:String(form.get("id")??""),organizationId:s.organizationId,studentId:s.studentId,publishAt:{lte:new Date()},readAt:null},data:{readAt:new Date()}});
 revalidatePath("/tenant/messages");
}
