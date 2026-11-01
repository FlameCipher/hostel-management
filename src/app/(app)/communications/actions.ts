"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { communicationManager, publishCommunication, scheduledDate, queueCommunicationCopies } from "@/lib/communications";
import { readMessageDelivery, type MessageDeliveryReport } from "@/lib/message-delivery";
export type CommunicationState={error?:string;success?:string;reportId?:string;report?:MessageDeliveryReport};
export async function publishAction(_state:CommunicationState, form:FormData):Promise<CommunicationState> {
 const session=await requireSession();
 // Sending is an explicit submit action; recheck the exact reviewed audience on the server.
 if(form.get("confirmed")!=="on") return {error:"Review and confirm the selected recipients and notice before saving."};
 const expected=Number(form.get("expectedRecipientCount"));
 if(!Number.isSafeInteger(expected) || expected<1 || expected>5000 || String(form.get("expectedRecipientCount"))!==String(expected))
   return {error:"The reviewed recipient count is unavailable. Refresh the notice and select recipients again."};
 const date=scheduledDate(String(form.get("publishAt")??""));
 if(!date) return {error:"Choose a future date within one year. Schedule uses Nairobi time."};
 try {
 const result=await publishCommunication(db,session,{title:form.get("title"),body:form.get("body"),audience:form.get("audience"),studentIds:form.getAll("studentIds"),expectedRecipientCount:expected,...(form.has("reviewedStudentIds")?{reviewedStudentIds:form.getAll("reviewedStudentIds")}:{}),category:form.get("category"),publishAt:date,email:form.get("email")==="on",whatsapp:form.get("whatsapp")==="on",requestId:form.get("requestId")});
 revalidatePath("/communications"); revalidatePath("/tenant/messages");
 if("reportId" in result && result.reportId) { await queueCommunicationCopies(db,new Date(),{organizationId:session.organizationId,batchId:result.reportId}); const report=await readMessageDelivery(db,session.organizationId,result.reportId); return {...result,report:report??undefined}; }
 return result;
 } catch { return {error:"Publication could not be confirmed. Refresh the communication history before retrying."}; }
}
export async function settingsAction(form:FormData) {
 const session=await requireSession(); if(!(await communicationManager(db,session))) return;
 await db.$transaction(async tx=>{
 const data={emailCopies:form.get("emailCopies")==="on",balanceEnabled:form.get("balanceEnabled")==="on",holidayEnabled:form.get("holidayEnabled")==="on",whatsappCopies:form.get("whatsappCopies")==="on"};
 await tx.communicationSettings.upsert({where:{organizationId:session.organizationId},create:{organizationId:session.organizationId,...data},update:data});
 await tx.auditLog.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"COMMUNICATION_AUTOMATION_UPDATED",entityType:"Organization",entityId:session.organizationId,metadata:data}});
 }); revalidatePath("/communications");
}

export async function retryEmailAction(form:FormData){
 const s=await requireSession();if(!(await communicationManager(db,s)))return;
 const id=String(form.get("id")??"");if(id.length>128)return;
 await db.$transaction(async tx=>{
 const result=await tx.tenantMessage.updateMany({where:{id,organizationId:s.organizationId,emailCopy:true,emailStatus:{in:["FAILED","MISSING_EMAIL"]}},data:{emailStatus:"QUEUED",emailRecipient:null,emailFrom:null,emailAttempts:0,emailAttemptAt:null,emailError:null,emailGeneration:{increment:1}}});
 if(result.count)await tx.auditLog.create({data:{organizationId:s.organizationId,actorUserId:s.userId,action:"COMMUNICATION_EMAIL_RETRY_QUEUED",entityType:"TenantMessage",entityId:id}});
 });revalidatePath("/communications");
}
