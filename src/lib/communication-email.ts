import type { PrismaClient } from "@/generated/prisma/client";
import { tenantWhere } from "@/lib/communications";
import { z } from "zod";
export function emailResult(status:number,providerId?:string){
 if(status>=200&&status<300&&providerId)return{status:"PROVIDER_ACCEPTED",error:null};
 if(status===429)return{status:"RETRY",error:"Email provider rate limit. Retrying on the next daily run."};
 if(status>=500 || status===408 || (status>=200&&status<300))return{status:"REVIEW",error:"Delivery could not be confirmed. Management must review the provider before resending."};
 return{status:"FAILED",error:"Email provider rejected the request. Check recipient and sender settings."};
}
export async function sendCommunicationEmails(db:PrismaClient,now=new Date(),fetcher:typeof fetch=fetch,config={apiKey:process.env.RESEND_API_KEY,from:process.env.RECEIPT_EMAIL_FROM}){
 if(!config.apiKey || !config.from)return{accepted:0,configured:false};
 const candidates=await db.tenantMessage.findMany({where:{emailCopy:true,publishAt:{lte:now},emailStatus:{in:["QUEUED","RETRY"]},emailAttempts:{lt:3},OR:[{emailAttemptAt:null},{emailAttemptAt:{lte:new Date(now.getTime()-3600000)}}]},select:{id:true},take:30,orderBy:{publishAt:"asc"}});
 let accepted=0;
 for(const candidate of candidates){
 const item=await db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "TenantMessage" WHERE id=${candidate.id} FOR UPDATE`;
 const message=await tx.tenantMessage.findUnique({where:{id:candidate.id}});if(!message || !["QUEUED","RETRY"].includes(message.emailStatus)||message.emailAttempts>=3)return null;
 const student=await tx.student.findFirst({where:{...tenantWhere(message.organizationId),id:message.studentId},select:{email:true}});
 if(!student){await tx.tenantMessage.update({where:{id:message.id},data:{emailStatus:"INELIGIBLE",emailError:"Recipient is no longer a current tenant."}});return null;}
 const recipient=message.emailRecipient??student.email;
 if(!recipient || !z.string().email().safeParse(recipient).success){await tx.tenantMessage.update({where:{id:message.id},data:{emailStatus:"MISSING_EMAIL",emailError:"Add a valid student email before retrying."}});return null;}
 return tx.tenantMessage.update({where:{id:message.id},data:{emailStatus:"SENDING",emailRecipient:recipient,emailFrom:message.emailFrom??config.from,emailAttempts:{increment:1},emailAttemptAt:now,emailError:null}});
 });if(!item)continue;
 let result:{status:string;error:string|null}={status:"REVIEW",error:"Delivery could not be confirmed. Review the email provider before resending."},providerId:string|undefined;
 try{
 const response=await fetcher("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${config.apiKey}`,"Content-Type":"application/json","Idempotency-Key":`hostel-notice/${item.id}/${item.emailGeneration}`},body:JSON.stringify({from:item.emailFrom,to:[item.emailRecipient],subject:item.title,text:`${item.body}\n\nAccess your private hostel account and contact management: https://hostel.sampesa.com/tenant/login\n\nThis is a hostel service notice. Reply to management through your tenant account.`}),signal:AbortSignal.timeout(10000)});
 if(response.ok){const payload=await response.json();providerId=typeof payload.id==="string"?payload.id:undefined;}
 result=emailResult(response.status,providerId);
 if(result.status==="RETRY"&&item.emailAttempts>=3)result={status:"FAILED",error:"Email retry limit reached. Management review required."};
 }catch{/* Ambiguous network results are never retried automatically. */}
 await db.tenantMessage.update({where:{id:item.id},data:{emailStatus:result.status,emailProviderId:providerId,emailError:result.error}});
 if(result.status==="PROVIDER_ACCEPTED")accepted++;
 }
 return{accepted,configured:true};
}
